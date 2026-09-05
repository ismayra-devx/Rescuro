"""Telnyx Voice Webhook and Bidirectional Media Streaming endpoints.

Supports:
- GET /telnyx/health: Service readiness and health check.
- POST /telnyx/webhook: Call lifecycle webhooks (initiated, answered, hangup).
- WebSocket /telnyx/media: Real-time bidirectional audio streaming connection.
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect

from app.config import settings
from app.models.events import EventType
from app.services.telnyx_service import telnyx_service, TelnyxService
from app.services.tts_service import TTSService

logger = logging.getLogger("echosphere.telnyx.routes")

router = APIRouter(prefix="/telnyx", tags=["Telnyx Voice"])


class TelnyxMediaConnection:
    """Manages an active bidirectional WebSocket media session with Telnyx."""

    def __init__(
        self,
        websocket: WebSocket,
        session_id: str,
        call_control_id: Optional[str] = None,
        stream_id: Optional[str] = None,
    ):
        self.websocket = websocket
        self.session_id = session_id
        self.call_control_id = call_control_id
        self.stream_id = stream_id
        self.audio_queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue()
        self.is_closed = False

    async def send_audio(self, audio_bytes: bytes) -> None:
        """Encodes raw u-law audio bytes into Telnyx media frame and sends to caller."""
        if self.is_closed:
            return
        msg = TelnyxService.create_media_message(audio_bytes, stream_id=self.stream_id)
        try:
            await self.websocket.send_json(msg)
        except Exception as exc:
            logger.warning(f"Failed to send audio to Telnyx ({self.session_id}): {exc}")

    async def send_clear(self) -> None:
        """Sends buffer clear message to immediately stop audio playback."""
        if self.is_closed:
            return
        msg = TelnyxService.create_clear_message(stream_id=self.stream_id)
        try:
            await self.websocket.send_json(msg)
        except Exception as exc:
            logger.warning(f"Failed to send clear to Telnyx ({self.session_id}): {exc}")

    def close(self) -> None:
        """Marks connection as closed and puts sentinel in audio queue."""
        self.is_closed = True
        try:
            self.audio_queue.put_nowait(None)
        except Exception:
            pass


class TelnyxConnectionManager:
    """Registry maintaining active Telnyx media connections per call/session."""

    def __init__(self):
        self._connections: Dict[str, TelnyxMediaConnection] = {}
        self._call_control_map: Dict[str, str] = {}  # call_control_id -> session_id

    def register(self, conn: TelnyxMediaConnection) -> None:
        self._connections[conn.session_id] = conn
        if conn.call_control_id:
            self._call_control_map[conn.call_control_id] = conn.session_id

    def get_by_session(self, session_id: str) -> Optional[TelnyxMediaConnection]:
        return self._connections.get(session_id)

    def get_by_call_control(self, call_control_id: str) -> Optional[TelnyxMediaConnection]:
        sid = self._call_control_map.get(call_control_id)
        return self._connections.get(sid) if sid else None

    def remove(self, session_id: str) -> Optional[TelnyxMediaConnection]:
        conn = self._connections.pop(session_id, None)
        if conn and conn.call_control_id:
            self._call_control_map.pop(conn.call_control_id, None)
        return conn


manager = TelnyxConnectionManager()


@router.get("/health")
async def telnyx_health() -> Dict[str, str]:
    """Health check endpoint confirming Telnyx adapter readiness."""
    return {
        "status": "ok",
        "provider": "telnyx",
        "webhook": "ready",
        "media_websocket": "ready",
    }


@router.post("/webhook")
async def telnyx_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    telnyx_signature: Optional[str] = Header(None, alias="telnyx-signature-ed25519"),
    telnyx_timestamp: Optional[str] = Header(None, alias="telnyx-timestamp"),
) -> Response:
    """Telnyx incoming call and lifecycle event webhook handler.
    
    Receives events, validates signatures, extracts call metadata, registers
    session instantly in memory, and dispatches call actions & event persistence.
    """
    raw_body = await request.body()
    telnyx_svc: TelnyxService = getattr(request.app.state, "telnyx_service", telnyx_service)

    # 1. Signature validation (skipped if TELNYX_PUBLIC_KEY is not configured)
    if not telnyx_svc.validate_signature(raw_body, telnyx_signature, telnyx_timestamp):
        raise HTTPException(status_code=403, detail="Invalid Telnyx webhook signature.")

    # 2. Parse Telnyx event payload
    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    event_data = data.get("data", {})
    event_type = event_data.get("event_type") or data.get("event_type", "")
    payload = event_data.get("payload") or data.get("payload", {})

    call_control_id = payload.get("call_control_id") or data.get("call_control_id")
    from_number = payload.get("from") or payload.get("caller_number")
    to_number = payload.get("to") or payload.get("called_number")

    orchestrator = request.app.state.orchestrator

    # 3. Handle call lifecycle events
    if event_type == "call.initiated":
        logger.info(f"Telnyx call initiated: call_control_id={call_control_id}, from={from_number}, to={to_number}")
        
        # Instant memory session registration
        session = orchestrator.create_session_instant(
            call_sid=call_control_id,
            from_number=from_number,
            to_number=to_number,
        )

        # Offload session persistence & CALL_STARTED broadcast to background
        background_tasks.add_task(orchestrator.persist_session_start, session)

        # Answer call and initiate streaming via Telnyx Call Control in background
        if call_control_id:
            stream_url = f"{settings.telnyx_websocket_url}?session_id={session.session_id}&call_control_id={call_control_id}"
            background_tasks.add_task(telnyx_service.answer_call, call_control_id)
            background_tasks.add_task(
                telnyx_service.start_streaming,
                call_control_id,
                stream_url,
            )

        return Response(
            content=json.dumps({
                "status": "ok",
                "event": "call.initiated",
                "session_id": session.session_id,
                "call_control_id": call_control_id,
            }),
            media_type="application/json",
        )

    elif event_type == "call.answered":
        logger.info(f"Telnyx call answered: call_control_id={call_control_id}")
        # Find active session if existing
        target_session = None
        for sid, s in orchestrator._sessions.items():
            if s.call_sid == call_control_id:
                target_session = s
                break

        if target_session and call_control_id:
            stream_url = f"{settings.telnyx_websocket_url}?session_id={target_session.session_id}&call_control_id={call_control_id}"
            background_tasks.add_task(
                telnyx_service.start_streaming,
                call_control_id,
                stream_url,
            )

        return Response(
            content=json.dumps({"status": "ok", "event": "call.answered"}),
            media_type="application/json",
        )

    elif event_type in ("call.hangup", "call.machine.hangup"):
        logger.info(f"Telnyx call hangup: call_control_id={call_control_id}")
        target_sid = None
        for sid, s in orchestrator._sessions.items():
            if s.call_sid == call_control_id:
                target_sid = sid
                break

        if target_sid:
            background_tasks.add_task(orchestrator.end_call, target_sid)

        return Response(
            content=json.dumps({"status": "ok", "event": "call.hangup"}),
            media_type="application/json",
        )

    # General event ACK
    return Response(
        content=json.dumps({"status": "ok", "event": event_type or "acknowledged"}),
        media_type="application/json",
    )


@router.websocket("/media")
async def telnyx_media_stream(
    websocket: WebSocket,
    session_id: Optional[str] = Query(None),
    call_control_id: Optional[str] = Query(None),
):
    """Bidirectional WebSocket media connection with Telnyx.
    
    Pipes incoming caller audio to Deepgram STT, runs transcripts through
    the existing AI triage orchestrator, and streams real synthesized TTS audio
    back to the caller.
    """
    await websocket.accept()
    orchestrator = websocket.app.state.orchestrator
    deepgram_svc = websocket.app.state.deepgram_service
    tts_svc: TTSService = websocket.app.state.tts_service

    # Identify or instantiate session
    session = None
    if session_id:
        session = orchestrator.get_session(session_id)
    if not session and call_control_id:
        for sid, s in orchestrator._sessions.items():
            if s.call_sid == call_control_id:
                session = s
                session_id = sid
                break
    if not session:
        session = orchestrator.create_session_instant(call_sid=call_control_id)
        session_id = session.session_id
        asyncio.create_task(orchestrator.persist_session_start(session))

    connection = TelnyxMediaConnection(
        websocket=websocket,
        session_id=session.session_id,
        call_control_id=call_control_id,
    )
    manager.register(connection)
    logger.info(f"Telnyx media connection established for session {session.session_id}")

    stop_event = asyncio.Event()

    # Async generator yielding audio chunks from connection queue for Deepgram STT
    async def audio_chunk_stream():
        while not stop_event.is_set():
            try:
                chunk = await asyncio.wait_for(connection.audio_queue.get(), timeout=0.5)
                if chunk is None:
                    break
                yield chunk
            except asyncio.TimeoutError:
                continue
            except Exception:
                break

    # Deepgram STT Consumer Worker
    async def stt_worker():
        try:
            async for chunk in deepgram_svc.transcribe_audio_stream(
                audio_chunk_stream(),
                sample_rate=8000,
                encoding="mulaw",
            ):
                if chunk.is_final or chunk.speech_final:
                    transcript_text = chunk.text.strip()
                    if transcript_text:
                        logger.info(f"Telnyx STT final transcript: '{transcript_text}' (conf: {chunk.confidence})")
                        
                        # Process transcript through existing intelligence & triage pipeline
                        triage_output = await orchestrator.process_transcript(
                            session_id=session.session_id,
                            transcript=transcript_text,
                            stt_confidence=chunk.confidence,
                        )

                        # If automated route and TTS not halted, stream synthesized audio back to caller
                        reply = triage_output.get("conversational_reply")
                        if reply and not session.tts_halted and session.status.value != "SUPERVISOR_CONNECTED":
                            audio_output = await tts_svc.synthesize_and_play(
                                session_id=session.session_id,
                                text=reply,
                                tts_halted=session.tts_halted,
                            )
                            if audio_output and not session.tts_halted:
                                await connection.send_audio(audio_output)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error(f"Error in Telnyx STT worker for session {session.session_id}: {exc}")

    stt_task = asyncio.create_task(stt_worker())

    try:
        while True:
            message_text = await websocket.receive_text()
            try:
                msg = json.loads(message_text)
            except Exception:
                continue

            event = msg.get("event")

            if event == "start":
                start_data = msg.get("start", {})
                connection.stream_id = msg.get("stream_id") or start_data.get("stream_id")
                call_ctrl = start_data.get("call_control_id")
                if call_ctrl and not connection.call_control_id:
                    connection.call_control_id = call_ctrl
                    manager.register(connection)
                logger.info(f"Telnyx media start: stream_id={connection.stream_id}, session={session.session_id}")

            elif event == "media":
                media_data = msg.get("media", {})
                payload_b64 = media_data.get("payload")
                if payload_b64:
                    try:
                        raw_audio = TelnyxService.decode_media_payload(payload_b64)
                        if not session.tts_halted:
                            await connection.audio_queue.put(raw_audio)
                    except Exception as exc:
                        logger.debug(f"Audio decode error: {exc}")

            elif event == "stop":
                logger.info(f"Telnyx media stop event received for session {session.session_id}")
                break

    except WebSocketDisconnect:
        logger.info(f"Telnyx WebSocket disconnected for session {session.session_id}")
    except Exception as exc:
        logger.warning(f"Telnyx WebSocket exception ({session.session_id}): {exc}")
    finally:
        stop_event.set()
        connection.close()
        manager.remove(session.session_id)
        stt_task.cancel()
        try:
            await stt_task
        except asyncio.CancelledError:
            pass
        # Mark session ended if not already completed
        if session.status.value != "COMPLETED":
            await orchestrator.end_call(session.session_id)
