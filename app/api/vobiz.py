"""Vobiz Telephony Integration for RESCURO.

Provides:
1. POST /vobiz/answer: Webhook returning Vobiz Voice XML to start bidirectional media streaming.
2. WS /vobiz/media: WebSocket server receiving and transmitting real-time call audio.

NOTE ON VOBIZ PROTOCOL ASSUMPTIONS:
All Vobiz XML structures and WebSocket JSON event payloads are marked with
detailed comments highlighting the assumed field names, audio formats, and
payload structures so they can easily be verified and adjusted against Vobiz's
official API documentation.
"""

import json
import base64
import logging
from typing import Optional
from fastapi import APIRouter, Request, Response, WebSocket, WebSocketDisconnect, status
from app.config import settings
from app.services import pipeline
from app.api.dashboard_ws import dashboard_manager

logger = logging.getLogger("rescuro.vobiz")
router = APIRouter(prefix="/vobiz", tags=["Vobiz Telephony"])


# ==============================================================================
# 1. Inbound Call Answer Webhook
# ==============================================================================

@router.post("/answer")
async def vobiz_answer_call(request: Request):
    """Webhook invoked by Vobiz when an incoming phone call is answered.

    Returns Vobiz Voice XML instructing Vobiz to establish a bidirectional
    audio stream with our WebSocket endpoint:
        {BASE_WS_URL}/vobiz/media

    ASSUMED XML SPECIFICATION:
    -------------------------
    Root Tag: <Response>
    Stream Tag: <Stream url="..." bidirectional="true" />
    (Alternative Vobiz syntax might wrap <Stream> in <Connect>, or specify attributes
    like format="pcm_mulaw" or sampleRate="8000".)
    Verify with your Vobiz Voice XML documentation.
    """
    stream_url = settings.vobiz_media_stream_url
    logger.info("Handling Vobiz inbound call. Media stream destination: %s", stream_url)

    # Optional: Read caller data sent in form body or query params by Vobiz
    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            body = await request.json()
            caller_number = body.get("From") or body.get("caller") or "Unknown"
        else:
            form_data = await request.form()
            caller_number = form_data.get("From") or form_data.get("caller") or "Unknown"
        logger.info("Call initiated from: %s", caller_number)
    except Exception:
        caller_number = "Unknown"

    # Notify dashboard about incoming call
    await dashboard_manager.broadcast("INCOMING_CALL", {
        "provider": "vobiz",
        "caller": caller_number,
        "media_stream_url": stream_url,
        "status": "CONNECTING"
    })

    # Construct Vobiz Voice XML
    # Using environment variable BASE_WS_URL (zero hardcoded domains)
    vobiz_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <!-- Instruct Vobiz to stream caller audio bidirectionally to our WebSocket -->
    <Stream url="{stream_url}" bidirectional="true" />
</Response>
""".strip()

    return Response(content=vobiz_xml, media_type="application/xml")


# ==============================================================================
# 2. Real-Time Audio WebSocket Stream
# ==============================================================================

@router.websocket("/media")
async def vobiz_media_websocket(websocket: WebSocket):
    """Bidirectional WebSocket endpoint for Vobiz media streaming.

    PROTOCOL FIELD ASSUMPTIONS (UNCONFIRMED - VERIFY AGAINST VOBIZ DOCS):
    ---------------------------------------------------------------------
    1. INCOMING MESSAGES (from Vobiz):
       We assume Vobiz sends JSON frames containing:
       - "event" or "type":
           * "connected" / "start": stream session initiated
           * "media": audio chunk frame
           * "stop" / "close": call ended
       - "stream_id" or "streamSid" or "call_id": Unique identifier for the audio stream
       - "media":
           * "payload": Base64-encoded raw audio chunk (typically 8000Hz G.711 μ-law or 16kHz PCM)
           * "timestamp": Integer timestamp (optional)
       - If Vobiz sends audio at top level: msg["payload"] or msg["data"]

    2. OUTBOUND MESSAGES (to Vobiz):
       We assume Vobiz expects outbound audio formatted as:
       {
           "event": "media",
           "stream_id": stream_id,
           "media": {
               "payload": "<base64_encoded_audio>"
           }
       }
       If Vobiz expects binary frames directly, `await websocket.send_bytes(audio_bytes)`
       can be toggled in this handler.
    """
    await websocket.accept()
    logger.info("Vobiz WebSocket media connection accepted.")

    stream_id: Optional[str] = None
    call_id: Optional[str] = None

    try:
        while True:
            raw_message = await websocket.receive_text()

            # Attempt JSON parsing
            try:
                msg = json.loads(raw_message)
            except json.JSONDecodeError:
                logger.warning("Received non-JSON message from Vobiz: %s", raw_message[:100])
                continue

            # Field extraction with fallbacks to avoid rigid assumptions
            event_type = (msg.get("event") or msg.get("type") or "").lower()
            stream_id = stream_id or msg.get("stream_id") or msg.get("streamSid") or "vobiz_stream"
            call_id = call_id or msg.get("call_id") or msg.get("callSid") or stream_id

            logger.debug("Vobiz WS frame received: event=%s, stream_id=%s", event_type, stream_id)

            # ------------------------------------------------------------------
            # Event: Start / Connected
            # ------------------------------------------------------------------
            if event_type in ["start", "connected", "connection"]:
                logger.info("Vobiz audio stream started: stream_id=%s, call_id=%s", stream_id, call_id)
                await dashboard_manager.broadcast("VOBIZ_CALL_STARTED", {
                    "stream_id": stream_id,
                    "call_id": call_id,
                    "event": "start"
                })
                continue

            # ------------------------------------------------------------------
            # Event: Audio Media Chunk
            # ------------------------------------------------------------------
            elif event_type in ["media", "audio"]:
                # Extract base64 payload from assumed locations
                media_container = msg.get("media")
                if isinstance(media_container, dict):
                    audio_b64 = media_container.get("payload") or media_container.get("data")
                else:
                    audio_b64 = msg.get("payload") or msg.get("data")

                if not audio_b64:
                    continue

                # Process voice turn through RESCURO's unified STT -> Orchestrator -> TTS pipeline
                pipeline_result = await pipeline.process_voice_turn(
                    audio_chunk=audio_b64,
                    session_id=stream_id,
                    metadata={"provider": "vobiz", "call_id": call_id}
                )

                # Broadcast live transcription & dispatch intent to Command Center dashboard
                await dashboard_manager.broadcast("CALL_TRANSCRIPT_UPDATE", {
                    "stream_id": stream_id,
                    "call_id": call_id,
                    "transcript": pipeline_result["transcript"],
                    "orchestrator": pipeline_result["orchestrator"]
                })

                # Stream synthesized response audio back to Vobiz caller
                # UNCONFIRMED OUTBOUND PROTOCOL: verify exact structure required by Vobiz
                outbound_audio_b64 = pipeline_result["audio_base64"]
                outbound_msg = {
                    "event": "media",
                    "stream_id": stream_id,
                    "media": {
                        "payload": outbound_audio_b64
                    }
                }
                await websocket.send_text(json.dumps(outbound_msg))
                logger.debug("Sent outbound audio response to Vobiz stream %s", stream_id)

            # ------------------------------------------------------------------
            # Event: Call Ended / Stop
            # ------------------------------------------------------------------
            elif event_type in ["stop", "ended", "close"]:
                logger.info("Vobiz call completed: stream_id=%s", stream_id)
                await dashboard_manager.broadcast("VOBIZ_CALL_ENDED", {
                    "stream_id": stream_id,
                    "call_id": call_id,
                    "status": "COMPLETED"
                })
                break

    except WebSocketDisconnect:
        logger.info("Vobiz WebSocket client disconnected gracefully (stream_id=%s)", stream_id)
        await dashboard_manager.broadcast("VOBIZ_CALL_DISCONNECTED", {"stream_id": stream_id})
    except Exception as e:
        logger.error("Unexpected error in Vobiz WebSocket session (%s): %s", stream_id, e)
        await dashboard_manager.broadcast("VOBIZ_CALL_ERROR", {"stream_id": stream_id, "error": str(e)})
