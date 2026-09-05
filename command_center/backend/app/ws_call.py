"""WebSocket route /ws/call for real-time authenticated voice streaming to Agro agent."""

import asyncio
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.agro_agent import AgroVoiceAgent
from app.auth import validate_ws_token
from app.database import add_call_log

logger = logging.getLogger("command_center.ws_call")
router = APIRouter(tags=["Voice Streaming"])


@router.websocket("/ws/call")
async def call_websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """Authenticated real-time voice call bridge to 'agro' voice agent."""
    await websocket.accept()

    # 1. Authenticate user from query parameter or initial handshake
    user = validate_ws_token(token)
    if not user:
        # Check if first message is auth handshake
        try:
            init_msg = await asyncio.wait_for(websocket.receive_text(), timeout=3.0)
            init_data = json.loads(init_msg)
            token = init_data.get("token")
            user = validate_ws_token(token)
        except Exception:
            pass

    if not user:
        logger.warning("Rejected unauthenticated WebSocket call connection.")
        await websocket.send_json({
            "type": "error",
            "message": "Authentication required. Valid JWT must be provided.",
            "status": "unauthorized",
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = user["id"]
    start_time = datetime.now(timezone.utc)
    agent = AgroVoiceAgent(sample_rate=16000)
    session_id = f"CMD-{user_id[:4].upper()}-{str(int(start_time.timestamp()))[-4:]}"
    logger.info(f"Secure voice call initiated by user {user['email']} (ID: {user_id}, Session: {session_id})")

    # Notify main RESCURO orchestrator backend (port 8000) so it appears live in the Auth / Supervisor dashboard
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post("http://127.0.0.1:8000/api/calls/start", json={
                "session_id": session_id,
                "caller": f"{user['full_name']} ({user['email']})",
                "location": "Command Center Tactical Line",
                "incident": "Active Voice Comm (Agro Voice Agent)",
            })
    except Exception as bridge_err:
        logger.debug(f"Auth dashboard bridge notice skipped: {bridge_err}")

    # Send connected confirmation
    await websocket.send_json({
        "type": "call_connected",
        "agent": "agro",
        "status": "secure",
        "caller": user["full_name"],
        "session_id": session_id,
        "start_time": start_time.isoformat(),
        "message": "Secure tactical line established with agro voice agent.",
    })

    call_status = "completed"

    try:
        while True:
            # Can receive binary audio bytes or JSON audio frames
            message = await websocket.receive()
            if "bytes" in message and message["bytes"]:
                raw_bytes = message["bytes"]
                agent_res = agent.process_incoming_audio(raw_bytes)
                await websocket.send_json(agent_res)

            elif "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                except Exception:
                    continue

                msg_type = data.get("type")

                if msg_type == "audio":
                    payload_b64 = data.get("payload", "")
                    if payload_b64:
                        raw_bytes = base64.b64decode(payload_b64)
                        agent_res = agent.process_incoming_audio(raw_bytes)
                        await websocket.send_json(agent_res)

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong", "time": datetime.now(timezone.utc).isoformat()})

                elif msg_type == "end_call":
                    logger.info(f"User {user_id} requested end of call.")
                    break

    except WebSocketDisconnect:
        logger.info(f"Call connection disconnected by client for user {user_id}.")
    except Exception as exc:
        logger.error(f"WebSocket voice call error for user {user_id}: {exc}")
        call_status = "interrupted"
    finally:
        end_time = datetime.now(timezone.utc)
        duration_sec = max(1, int((end_time - start_time).total_seconds()))
        # Record call log in SQLite database
        try:
            add_call_log(
                user_id=user_id,
                start_time=start_time.isoformat(),
                end_time=end_time.isoformat(),
                duration_sec=duration_sec,
                status=call_status,
            )
            logger.info(f"Recorded call log for user {user_id}: {duration_sec}s ({call_status})")
        except Exception as exc:
            logger.error(f"Failed to record call log: {exc}")

        # Notify main RESCURO backend so it is removed from active calls in the Auth dashboard
        try:
            import httpx
            async with httpx.AsyncClient(timeout=2.0) as client:
                await client.post("http://127.0.0.1:8000/api/calls/end", json={
                    "session_id": session_id,
                })
        except Exception as bridge_err:
            logger.debug(f"Auth dashboard bridge end notice skipped: {bridge_err}")

        try:
            await websocket.send_json({
                "type": "call_ended",
                "duration_sec": duration_sec,
                "status": call_status,
            })
            await websocket.close()
        except Exception:
            pass
