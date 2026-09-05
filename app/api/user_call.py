"""User Call WebSocket endpoint for RESCURO "Call RESCURO" & Speech-to-Text.

Wires user dashboard calls directly into the real STT -> Orchestrator -> TTS pipeline,
persists records to the shared call_sessions table, and broadcasts live telemetry
and transcription events to the dispatcher dashboard in real time.
"""

import asyncio
import json
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from app.api.auth import authenticate_ws_token
from app.api.dashboard_ws import dashboard_manager
from app.database import create_call_session, update_call_session, append_call_transcript
from app.services import pipeline

logger = logging.getLogger("rescuro.user_call")
router = APIRouter(tags=["User Voice Call"])


@router.websocket("/ws/call")
async def user_call_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """Authenticated real-time voice call endpoint for user dashboard.

    Integrates with:
    1. app/api/auth.py (JWT authentication)
    2. app/services/pipeline.py (Real STT -> Orchestrator -> TTS)
    3. app/database.py (Shared call_sessions table)
    4. app/api/dashboard_ws.py (Real-time dispatcher broadcast)
    """
    # 1. Authenticate user from query parameter
    user = None
    if token:
        try:
            user = await authenticate_ws_token(token)
        except Exception as err:
            logger.warning("Token verification failed via query param: %s", err)

    if not user and not token:
        logger.warning("Rejected unauthenticated WebSocket call connection: missing token")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required")
        return

    await websocket.accept()

    if not user:
        # Check if first message is an authentication handshake
        try:
            raw_init = await asyncio.wait_for(websocket.receive_text(), timeout=3.0)
            init_data = json.loads(raw_init)
            init_token = init_data.get("token")
            if init_token:
                user = await authenticate_ws_token(init_token)
        except Exception:
            pass

    if not user:
        logger.warning("Rejected unauthenticated WebSocket call connection: invalid handshake")
        await websocket.send_json({
            "type": "error",
            "message": "Authentication required. Valid JWT must be provided.",
            "status": "unauthorized",
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. Establish call session
    start_time = datetime.now(timezone.utc)
    session_id = f"CMD-{user.id}-{int(start_time.timestamp())}"
    caller_display = user.full_name or user.email
    logger.info("User %s (ID: %d) initiated tactical call session: %s", user.email, user.id, session_id)

    # Record call start in shared database
    await create_call_session(
        call_id=session_id,
        user_id=user.id,
        caller_name=caller_display,
        source="dashboard_call",
        status="active",
        start_time=start_time
    )

    # Broadcast call start to Dispatcher Dashboard in real-time
    await dashboard_manager.broadcast("INCOMING_CALL", {
        "call_id": session_id,
        "session_id": session_id,
        "caller": caller_display,
        "caller_email": user.email,
        "source": "dashboard_call",
        "status": "ACTIVE"
    })
    await dashboard_manager.broadcast("VOBIZ_CALL_STARTED", {
        "stream_id": session_id,
        "call_id": session_id,
        "caller": caller_display,
        "source": "dashboard_call",
        "event": "start"
    })

    # Send confirmation to user client
    await websocket.send_json({
        "type": "call_connected",
        "session_id": session_id,
        "call_id": session_id,
        "caller": caller_display,
        "status": "connected",
        "start_time": start_time.isoformat(),
        "message": "Secure tactical line established with RESCURO AI Engine."
    })

    call_status = "completed"

    try:
        while True:
            message = await websocket.receive()

            # Handle raw audio bytes
            if "bytes" in message and message["bytes"]:
                raw_bytes = message["bytes"]
                # Process voice turn through REAL STT -> Orchestrator -> TTS pipeline
                result = await pipeline.process_voice_turn(
                    audio_chunk=raw_bytes,
                    session_id=session_id,
                    metadata={"caller": caller_display, "user_id": user.id}
                )

                # Append transcript to database
                await append_call_transcript(session_id, result["transcript"])

                # Broadcast live transcript update to dispatcher dashboard
                await dashboard_manager.broadcast("CALL_TRANSCRIPT_UPDATE", {
                    "stream_id": session_id,
                    "session_id": session_id,
                    "call_id": session_id,
                    "caller": caller_display,
                    "transcript": result["transcript"],
                    "orchestrator": result["orchestrator"]
                })

                # Stream synthesized speech audio back to caller
                await websocket.send_json({
                    "type": "agent_audio",
                    "payload": result["audio_base64"],
                    "transcript": result["transcript"],
                    "orchestrator": result["orchestrator"]
                })

            # Handle JSON frames
            elif "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                except Exception:
                    continue

                msg_type = data.get("type", "").lower()

                # Case A: Audio payload in base64
                if msg_type == "audio":
                    payload_b64 = data.get("payload", "")
                    if payload_b64:
                        result = await pipeline.process_voice_turn(
                            audio_chunk=payload_b64,
                            session_id=session_id,
                            metadata={"caller": caller_display, "user_id": user.id}
                        )

                        await append_call_transcript(session_id, result["transcript"])

                        # Broadcast to dispatcher dashboard
                        await dashboard_manager.broadcast("CALL_TRANSCRIPT_UPDATE", {
                            "stream_id": session_id,
                            "session_id": session_id,
                            "call_id": session_id,
                            "caller": caller_display,
                            "transcript": result["transcript"],
                            "orchestrator": result["orchestrator"]
                        })

                        # Return synthesized audio to user
                        await websocket.send_json({
                            "type": "agent_audio",
                            "payload": result["audio_base64"],
                            "transcript": result["transcript"],
                            "orchestrator": result["orchestrator"]
                        })

                # Case B: Direct Speech-to-Text streaming chunk (from "Start speech to text")
                elif msg_type in ["transcript_stream", "stt_stream", "text_chunk", "speech_to_text"]:
                    text = (data.get("text") or data.get("transcript") or "").strip()
                    if text:
                        orch = await pipeline.run_orchestrator(
                            transcript=text,
                            session_id=session_id,
                            metadata={"caller": caller_display, "source": "stt_stream"}
                        )
                        await append_call_transcript(session_id, text)

                        # Broadcast each transcript chunk live to the dispatcher's "Live Call Transcription" panel
                        await dashboard_manager.broadcast("CALL_TRANSCRIPT_UPDATE", {
                            "stream_id": session_id,
                            "session_id": session_id,
                            "call_id": session_id,
                            "caller": caller_display,
                            "transcript": text,
                            "orchestrator": orch
                        })

                        # Acknowledge to user client
                        await websocket.send_json({
                            "type": "transcript_ack",
                            "text": text,
                            "orchestrator": orch
                        })

                # Case C: Heartbeat ping
                elif msg_type == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "time": datetime.now(timezone.utc).isoformat()
                    })

                # Case D: User requested end of call
                elif msg_type == "end_call":
                    logger.info("User %s requested end of call.", user.email)
                    break

    except WebSocketDisconnect:
        logger.info("User call session disconnected: %s", session_id)
    except Exception as exc:
        logger.error("Error in user call WebSocket loop (%s): %s", session_id, exc)
        call_status = "interrupted"
    finally:
        end_time = datetime.now(timezone.utc)
        duration_sec = max(1, int((end_time - start_time).total_seconds()))

        # Persist completed call session to shared SQLite database
        try:
            await update_call_session(
                call_id=session_id,
                end_time=end_time,
                duration_sec=duration_sec,
                status=call_status
            )
            logger.info("Recorded completed call session %s: %ds (%s)", session_id, duration_sec, call_status)
        except Exception as db_err:
            logger.error("Failed to update call session in database: %s", db_err)

        # Broadcast end event to Dispatcher Dashboard
        await dashboard_manager.broadcast("VOBIZ_CALL_ENDED", {
            "stream_id": session_id,
            "call_id": session_id,
            "duration_sec": duration_sec,
            "status": "COMPLETED"
        })
        await dashboard_manager.broadcast("CALL_ENDED", {
            "session_id": session_id,
            "call_id": session_id,
            "duration_sec": duration_sec,
            "status": "COMPLETED"
        })

        try:
            await websocket.send_json({
                "type": "call_ended",
                "duration_sec": duration_sec,
                "status": call_status
            })
            await websocket.close()
        except Exception:
            pass
