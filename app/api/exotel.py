"""Exotel AgentStream Voice Bot Integration for RESCURO.

Implements bidirectional audio streaming over WebSocket:
WS /exotel/media

Protocol events:
- connected  -> Connection handshake
- start      -> Session initialization, keyed as EXO-{call_sid}
- media      -> Bidirectional audio (PCM16 8kHz mono <-> G.711 u-law transcoding)
- dtmf       -> DTMF tones handling/logging
- mark       -> Playback synchronization marks
- clear      -> Audio buffer clearance
- stop       -> Session termination and database logging
"""

import json
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.api.dashboard_ws import dashboard_manager
from app.database import create_call_session, update_call_session, append_call_transcript
from app.services import pipeline
from app.services.tts_service import pcm16_to_ulaw, ulaw_to_pcm16

logger = logging.getLogger("rescuro.exotel")
router = APIRouter(prefix="/exotel", tags=["Exotel Telephony"])


@router.websocket("/media")
async def exotel_media_websocket(websocket: WebSocket):
    """Bidirectional WebSocket endpoint for Exotel AgentStream voice bot protocol.

    Audio Specs:
    - Inbound: Base64 PCM16, 8kHz, mono -> Transcoded to ITU-T G.711 u-law -> Pipeline
    - Outbound: Pipeline u-law -> Transcoded to PCM16, 8kHz, mono -> Base64 Exotel media
    """
    await websocket.accept()
    logger.info("EXOTEL CONNECTED")

    stream_sid: Optional[str] = None
    call_sid: Optional[str] = None
    session_id: Optional[str] = None
    start_time = datetime.now(timezone.utc)
    call_status = "completed"

    try:
        while True:
            raw_message = await websocket.receive_text()

            try:
                msg = json.loads(raw_message)
            except json.JSONDecodeError:
                logger.warning("Received invalid non-JSON payload from Exotel: %s", raw_message[:100])
                continue

            event_type = (msg.get("event") or "").lower()

            # ------------------------------------------------------------------
            # 1. Connected Event
            # ------------------------------------------------------------------
            if event_type == "connected":
                logger.info("EXOTEL CONNECTED")
                continue

            # ------------------------------------------------------------------
            # 2. Start Event
            # ------------------------------------------------------------------
            elif event_type == "start":
                start_data = msg.get("start", {})
                stream_sid = msg.get("stream_sid") or start_data.get("stream_sid") or "exo_stream"
                call_sid = start_data.get("call_sid") or start_data.get("callSid") or msg.get("call_sid") or stream_sid
                from_number = start_data.get("from") or start_data.get("caller") or "Exotel Caller"

                # Key session ID using existing scheme EXO-{call_sid}
                session_id = f"EXO-{call_sid}"
                start_time = datetime.now(timezone.utc)

                logger.info("CALL STARTED (session_id=%s, stream_sid=%s)", session_id, stream_sid)

                # Persist call start in shared call_sessions table
                await create_call_session(
                    call_id=session_id,
                    caller_name=from_number,
                    source="exotel",
                    status="active",
                    start_time=start_time
                )

                # Broadcast live call start to dispatcher dashboard
                await dashboard_manager.broadcast("INCOMING_CALL", {
                    "call_id": session_id,
                    "session_id": session_id,
                    "caller": from_number,
                    "source": "exotel",
                    "status": "ACTIVE"
                })
                await dashboard_manager.broadcast("VOBIZ_CALL_STARTED", {
                    "stream_id": stream_sid,
                    "call_id": session_id,
                    "caller": from_number,
                    "source": "exotel",
                    "event": "start"
                })
                continue

            # ------------------------------------------------------------------
            # 3. Media Audio Chunk Event (Bidirectional Flow)
            # ------------------------------------------------------------------
            elif event_type == "media":
                media_container = msg.get("media", {})
                payload = media_container.get("payload") if isinstance(media_container, dict) else msg.get("payload")

                if not payload:
                    continue

                logger.info("AUDIO RECEIVED (stream_sid=%s)", stream_sid)

                # Step 2: Audio Format Bridging
                # Exotel sends Base64-encoded PCM16 8kHz mono.
                # Decode Base64 -> raw PCM16 bytes
                try:
                    pcm16_bytes = base64.b64decode(payload)
                except Exception as b64_err:
                    logger.warning("Failed to decode base64 audio from Exotel: %s", b64_err)
                    continue

                # Transcode PCM16 (16-bit linear) -> ITU-T G.711 u-law
                ulaw_bytes = pcm16_to_ulaw(pcm16_bytes)
                ulaw_b64 = base64.b64encode(ulaw_bytes).decode("ascii")

                active_session = session_id or f"EXO-{stream_sid or 'active'}"

                # Step 3: Forward into existing STT -> Orchestrator -> TTS pipeline
                result = await pipeline.process_voice_turn(
                    audio_chunk=ulaw_b64,
                    session_id=active_session,
                    metadata={"provider": "exotel", "call_sid": call_sid, "stream_sid": stream_sid}
                )

                transcript = result["transcript"]
                response_text = result["orchestrator"]["response_text"]

                # Step 6: Required Lifecycle Logging
                logger.info("TRANSCRIPT: %s", transcript)
                logger.info("AI RESPONSE: %s", response_text)

                # Persist transcript in database
                await append_call_transcript(active_session, transcript)

                # Broadcast live transcript & orchestrator decision to Dispatcher Dashboard
                await dashboard_manager.broadcast("CALL_TRANSCRIPT_UPDATE", {
                    "stream_id": stream_sid,
                    "session_id": active_session,
                    "call_id": active_session,
                    "transcript": transcript,
                    "orchestrator": result["orchestrator"]
                })

                # Step 4 & 5: TTS Response Path & Outbound Media
                # The pipeline synthesized audio bytes in 8kHz G.711 u-law format.
                # Convert u-law -> 16-bit linear PCM 8kHz mono for Exotel AgentStream
                ulaw_audio = result["audio_bytes"]
                pcm16_audio = ulaw_to_pcm16(ulaw_audio)
                outbound_b64 = base64.b64encode(pcm16_audio).decode("ascii")

                logger.info("TTS GENERATED (pcm16_bytes=%d)", len(pcm16_audio))

                # Send outbound media frame back through WebSocket
                outbound_message = {
                    "event": "media",
                    "stream_sid": stream_sid,
                    "media": {
                        "payload": outbound_b64
                    }
                }
                await websocket.send_text(json.dumps(outbound_message))
                logger.info("AUDIO SENT (stream_sid=%s)", stream_sid)

            # ------------------------------------------------------------------
            # 4. DTMF Digits Event
            # ------------------------------------------------------------------
            elif event_type == "dtmf":
                digit = msg.get("dtmf", {}).get("digit") if isinstance(msg.get("dtmf"), dict) else msg.get("digit")
                logger.info("DTMF RECEIVED: digit=%s (stream_sid=%s)", digit, stream_sid)

            # ------------------------------------------------------------------
            # 5. Mark Event
            # ------------------------------------------------------------------
            elif event_type == "mark":
                mark_name = msg.get("mark", {}).get("name") if isinstance(msg.get("mark"), dict) else msg.get("name")
                logger.info("MARK RECEIVED: name=%s (stream_sid=%s)", mark_name, stream_sid)

            # ------------------------------------------------------------------
            # 6. Clear Event (Buffer Flush)
            # ------------------------------------------------------------------
            elif event_type == "clear":
                logger.info("CLEAR BUFFER (stream_sid=%s)", stream_sid)

            # ------------------------------------------------------------------
            # 7. Stop Event
            # ------------------------------------------------------------------
            elif event_type == "stop":
                logger.info("CALL STOPPED (stream_sid=%s)", stream_sid)
                break

    except WebSocketDisconnect:
        logger.info("Exotel WebSocket disconnected gracefully: %s", session_id or stream_sid)
    except Exception as exc:
        logger.error("Error in Exotel WebSocket session (%s): %s", session_id or stream_sid, exc)
        call_status = "interrupted"
    finally:
        end_time = datetime.now(timezone.utc)
        duration_sec = max(1, int((end_time - start_time).total_seconds()))
        active_session = session_id or f"EXO-{stream_sid or 'session'}"

        try:
            await update_call_session(
                call_id=active_session,
                end_time=end_time,
                duration_sec=duration_sec,
                status=call_status
            )
        except Exception as db_err:
            logger.error("Failed to update Exotel call session in DB: %s", db_err)

        # Broadcast end of call to dispatcher dashboard
        await dashboard_manager.broadcast("VOBIZ_CALL_ENDED", {
            "stream_id": stream_sid,
            "call_id": active_session,
            "duration_sec": duration_sec,
            "status": "COMPLETED"
        })
        await dashboard_manager.broadcast("CALL_ENDED", {
            "session_id": active_session,
            "call_id": active_session,
            "duration_sec": duration_sec,
            "status": "COMPLETED"
        })

        logger.info("CALL STOPPED (session_id=%s, duration=%ds)", active_session, duration_sec)

        try:
            await websocket.close()
        except Exception:
            pass
