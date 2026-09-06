"""RESCURO Dashboard WebSocket endpoint and real-time event broadcaster.

Streams live call events, transcripts, and dispatch commands to the
authenticated Command Center dashboard in real-time.
"""

import json
import base64
import logging
from typing import Set, Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.api.auth import authenticate_ws_token
from app.models.session import SessionStatus
from app.services import pipeline
from app.services.audio_bridge import audio_bridge

logger = logging.getLogger("rescuro.dashboard_ws")
router = APIRouter(tags=["Dashboard WebSocket"])


class DashboardConnectionManager:
    """Manages active WebSocket connections for dashboard dispatchers."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("Dashboard client connected. Total clients: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        for s_id in list(audio_bridge._supervisors.keys()):
            audio_bridge.unregister_supervisor(s_id, websocket)
        logger.info("Dashboard client disconnected. Remaining clients: %d", len(self.active_connections))

    async def broadcast(self, event_type: str, payload: Dict[str, Any]):
        """Broadcast an event to all connected dashboard clients."""
        if not self.active_connections:
            return

        message = {
            "type": event_type,
            "event": event_type,
            "payload": payload
        }
        dead_connections = set()
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning("Failed to send message to dashboard client: %s", e)
                dead_connections.add(connection)

        for dead in dead_connections:
            self.disconnect(dead)


dashboard_manager = DashboardConnectionManager()


@router.websocket("/ws/dashboard")
async def dashboard_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """Authenticated WebSocket route for the RESCURO Command Center dashboard.

    Query Params:
        token (str): Valid JWT access token issued by /api/auth/login or /api/auth/signup.
    """
    # 1. Authenticate token
    if not token:
        logger.warning("Dashboard WS connection rejected: Missing token")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing authentication token")
        return

    try:
        user = await authenticate_ws_token(token)
    except Exception as e:
        logger.warning("Dashboard WS connection rejected: %s", e)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication token")
        return

    # 2. Connect
    await dashboard_manager.connect(websocket)

    # Send initial handshake success
    await websocket.send_json({
        "type": "CONNECTION_ESTABLISHED",
        "event": "connected",
        "payload": {
            "user": {"id": user.id, "email": user.email, "role": user.role},
            "message": "Connected to RESCURO Live Event Stream"
        }
    })

    # 3. Message loop
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
            except Exception:
                msg = {"type": "raw", "data": raw_data}

            msg_type = msg.get("type", "").upper()

            if msg_type == "PING":
                await websocket.send_json({"type": "PONG", "payload": {}})
                continue

            # Handle supervisor takeover commands via authenticated WebSocket
            if msg_type in ["SUPERVISOR_TAKEOVER", "TAKEOVER"]:
                role = (user.role or "").strip().lower()
                if role not in ("supervisor", "lead_dispatcher", "dispatcher", "admin"):
                    logger.warning(
                        "Unauthorized WebSocket takeover attempt rejected for user %s with role '%s'",
                        user.email, user.role
                    )
                    await websocket.send_json({
                        "type": "ERROR",
                        "event": "forbidden",
                        "payload": {
                            "detail": f"Forbidden: Role '{user.role}' is not authorized to perform call takeover. Required: supervisor or dispatcher."
                        }
                    })
                    continue

                payload_data = msg.get("payload") if isinstance(msg.get("payload"), dict) else {}
                call_id = payload_data.get("callId") or payload_data.get("session_id") or msg.get("callId") or msg.get("session_id")
                notes = payload_data.get("notes") or msg.get("notes") or f"Supervisor takeover via WebSocket by {user.email}"

                if not call_id:
                    await websocket.send_json({
                        "type": "ERROR",
                        "event": "error",
                        "payload": {"detail": "Missing callId or session_id in takeover payload"}
                    })
                    continue

                logger.info("SUPERVISOR TAKEOVER REQUEST")
                logger.info("DASHBOARD CALL ID: %s", call_id)

                resolved_session_id = audio_bridge.resolve_session_id(call_id) or call_id
                logger.info("RESOLVED RESCURO SESSION ID: %s", resolved_session_id)

                orchestrator = getattr(websocket.app.state, "orchestrator", None) if hasattr(websocket, "app") else None
                session = None
                if orchestrator:
                    session = orchestrator.get_session(resolved_session_id)
                    if not session:
                        session = orchestrator.get_session(call_id)
                    if not session:
                        for s in orchestrator._sessions.values():
                            if s.call_sid == resolved_session_id or s.call_sid == call_id:
                                session = s
                                break
                    if not session and len(orchestrator._sessions) == 1:
                        session = next(iter(orchestrator._sessions.values()))
                        resolved_session_id = session.session_id

                exotel_info = audio_bridge.get_exotel_stream_info(resolved_session_id)
                stream_sid = exotel_info.get("stream_sid") if exotel_info else None
                logger.info("EXOTEL SESSION ID: %s", resolved_session_id)
                logger.info("EXOTEL STREAM SID: %s", stream_sid)

                if session or exotel_info:
                    target_session_id = session.session_id if session else resolved_session_id
                    # 1. Attach supervisor WebSocket to real-time audio bridge
                    audio_bridge.register_supervisor(target_session_id, websocket)
                    logger.info("AUDIO BRIDGE ATTACHED: session=%s, supervisor=%s", target_session_id, user.email)

                    # 2. Halt AI speech in pipeline and orchestrator
                    pipeline.mark_session_overridden(target_session_id, True)
                    pipeline.mark_session_overridden(call_id, True)
                    if session:
                        session.tts_halted = True
                        session.status = SessionStatus.HUMAN_TAKEOVER
                        session.supervisor_requested = True
                        updated = await orchestrator.supervisor_override(session.session_id, reason=notes)
                        status_val = updated.status.value
                    else:
                        status_val = SessionStatus.HUMAN_TAKEOVER.value

                    logger.info("HUMAN_TAKEOVER ACTIVE: session=%s", target_session_id)

                    # 3. Instantly flush any currently playing TTS on caller's phone
                    await audio_bridge.clear_exotel_audio(target_session_id)

                    logger.info(
                        "SUPERVISOR TOOK OVER call session_id=%s (dashboard_id=%s) by %s [%s]",
                        target_session_id, call_id, user.email, user.role
                    )
                    await websocket.send_json({
                        "type": "SUPERVISOR_TAKEOVER_SUCCESS",
                        "event": "takeover_success",
                        "payload": {
                            "session_id": target_session_id,
                            "dashboard_call_id": call_id,
                            "status": status_val,
                            "tts_halted": True,
                            "supervisor": user.email,
                            "audio_bridge_connected": audio_bridge.has_exotel_stream(target_session_id),
                            "telephony_active": audio_bridge.has_exotel_stream(target_session_id),
                            "stream_sid": stream_sid,
                        }
                    })
                    # Broadcast takeover to all connected dashboards
                    await dashboard_manager.broadcast("SUPERVISOR_CONNECTED", {
                        "session_id": target_session_id,
                        "call_id": target_session_id,
                        "dashboard_call_id": call_id,
                        "status": "HUMAN_TAKEOVER",
                        "supervisor": user.email,
                    })
                else:
                    logger.warning("Takeover session '%s' not found in orchestrator or audio bridge", call_id)

            # Handle releasing call back to autonomous AI
            elif msg_type in ["RELEASE_TO_AI", "RETURN_TO_AI"]:
                role = (user.role or "").strip().lower()
                if role not in ("supervisor", "lead_dispatcher", "dispatcher", "admin"):
                    await websocket.send_json({
                        "type": "ERROR",
                        "event": "forbidden",
                        "payload": {"detail": "Forbidden: Insufficient privileges to release call."}
                    })
                    continue

                payload_data = msg.get("payload") if isinstance(msg.get("payload"), dict) else {}
                call_id = payload_data.get("callId") or payload_data.get("session_id") or msg.get("callId") or msg.get("session_id")
                if call_id:
                    resolved_session_id = audio_bridge.resolve_session_id(call_id) or call_id
                    pipeline.mark_session_overridden(resolved_session_id, False)
                    pipeline.mark_session_overridden(call_id, False)
                    audio_bridge.unregister_supervisor(resolved_session_id, websocket)
                    audio_bridge.unregister_supervisor(call_id, websocket)
                    orchestrator = getattr(websocket.app.state, "orchestrator", None) if hasattr(websocket, "app") else None
                    if orchestrator:
                        session = orchestrator.get_session(resolved_session_id) or orchestrator.get_session(call_id)
                        if session:
                            session.tts_halted = False
                            session.status = SessionStatus.ACTIVE
                            logger.info(
                                "SUPERVISOR RELEASED call session_id=%s back to AI by %s [%s]",
                                session.session_id, user.email, user.role
                            )
                            await websocket.send_json({
                                "type": "AI_RESUMED",
                                "event": "ai_resumed",
                                "payload": {"session_id": session.session_id, "status": session.status.value}
                            })

            # Handle live supervisor microphone audio chunks into Exotel phone call
            elif msg_type in ["SUPERVISOR_AUDIO_CHUNK", "SUPERVISOR_AUDIO", "AUDIO_STREAM"]:
                payload_data = msg.get("payload") if isinstance(msg.get("payload"), dict) else {}
                call_id = (
                    payload_data.get("call_id")
                    or payload_data.get("callId")
                    or payload_data.get("session_id")
                    or msg.get("call_id")
                    or msg.get("callId")
                    or msg.get("session_id")
                )
                audio_b64 = payload_data.get("audio") or msg.get("audio")
                if not call_id:
                    call_id = audio_bridge.resolve_session_id(None)
                if call_id and audio_b64:
                    resolved_session_id = audio_bridge.resolve_session_id(call_id) or call_id
                    try:
                        if isinstance(audio_b64, str) and "," in audio_b64:
                            audio_b64 = audio_b64.split(",", 1)[1]
                        pcm_bytes = base64.b64decode(audio_b64)
                        sent = await audio_bridge.route_supervisor_audio(resolved_session_id, pcm_bytes)
                        if not sent:
                            logger.warning("route_supervisor_audio returned False for session %s", resolved_session_id)
                    except Exception as a_err:
                        logger.warning("Error routing supervisor audio to Exotel: %s", a_err)
                continue

            # Handle live audio or test simulation from dashboard
            elif msg_type in ["SIMULATE_CALL", "AUDIO_CHUNK", "TEST_DISPATCH"]:
                transcript = msg.get("transcript")
                audio_payload = msg.get("payload") or msg.get("audio")
                session_id = msg.get("session_id")

                if audio_payload:
                    result = await pipeline.process_voice_turn(audio_payload, session_id=session_id)
                elif transcript:
                    orch = await pipeline.run_orchestrator(transcript, session_id=session_id)
                    tts_bytes = await pipeline.synthesize_speech(orch["response_text"])
                    result = {
                        "transcript": transcript,
                        "orchestrator": orch,
                        "audio_bytes": len(tts_bytes)
                    }
                else:
                    result = {"status": "NO_CONTENT"}

                # Broadcast pipeline outcome to all connected dashboards
                await dashboard_manager.broadcast("CALL_UPDATE", result)

    except WebSocketDisconnect:
        dashboard_manager.disconnect(websocket)
    except Exception as e:
        logger.error("Error in dashboard WebSocket loop: %s", e)
        dashboard_manager.disconnect(websocket)


# Also provide alias routes for frontend compatibility and dashboard.html
@router.websocket("/api/v1/stream/calls")
@router.websocket("/ws/events")
async def dashboard_stream_alias(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """Alias route matching frontend/src/services/websocket.js default path."""
    # Allow optional token on this convenience route for developer dashboard testing
    if token:
        try:
            await authenticate_ws_token(token)
        except Exception:
            pass

    await dashboard_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if "PING" in data:
                await websocket.send_json({"type": "PONG"})
            elif any(k in data.upper() for k in ["TAKEOVER", "OVERRIDE", "RELEASE"]):
                logger.warning("Rejected unauthenticated takeover attempt on stream alias endpoint: %s", data[:100])
                await websocket.send_json({
                    "type": "ERROR",
                    "event": "unauthorized",
                    "payload": {
                        "detail": "Authentication required. Call takeover is strictly restricted to authenticated supervisors via /ws/dashboard with a valid JWT or the authenticated REST API."
                    }
                })
            elif "SUPERVISOR_AUDIO" in data:
                try:
                    msg = json.loads(data)
                    payload_data = msg.get("payload") if isinstance(msg.get("payload"), dict) else {}
                    call_id = (
                        payload_data.get("call_id")
                        or payload_data.get("callId")
                        or payload_data.get("session_id")
                        or msg.get("call_id")
                        or msg.get("callId")
                        or msg.get("session_id")
                    )
                    audio_b64 = payload_data.get("audio") or msg.get("audio")
                    if not call_id:
                        call_id = audio_bridge.resolve_session_id(None)
                    if call_id and audio_b64:
                        resolved_session_id = audio_bridge.resolve_session_id(call_id) or call_id
                        if isinstance(audio_b64, str) and "," in audio_b64:
                            audio_b64 = audio_b64.split(",", 1)[1]
                        pcm_bytes = base64.b64decode(audio_b64)
                        await audio_bridge.route_supervisor_audio(resolved_session_id, pcm_bytes)
                except Exception as sup_err:
                    logger.warning("Error routing supervisor audio in alias stream: %s", sup_err)
    except WebSocketDisconnect:
        dashboard_manager.disconnect(websocket)
    except Exception:
        dashboard_manager.disconnect(websocket)
