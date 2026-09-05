"""Automated tests for Unified RESCURO Backend.
Verifies auth, /api/auth/me, /ws/call user audio and STT streaming, call_sessions persistence,
and GET /api/calls/history.
"""

import pytest
import json
import base64
import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_auth_me_and_full_name():
    """Verify registration with full_name and retrieval via /api/auth/me."""
    email = f"officer_{int(time.time() * 1000)}@rescuro.org"
    password = "SecurePassword123!"
    full_name = "Officer Sarah Connor"

    # Signup
    signup_resp = client.post("/api/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": full_name,
        "role": "responder"
    })
    assert signup_resp.status_code == 201
    signup_data = signup_resp.json()
    assert "access_token" in signup_data
    token = signup_data["access_token"]
    assert signup_data["user"]["full_name"] == full_name

    # /api/auth/me
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == email
    assert me_data["full_name"] == full_name


def test_user_call_websocket_and_history():
    """Verify /ws/call handles audio frames and STT chunks, saving to call_sessions."""
    email = f"caller_{int(time.time() * 1000)}@rescuro.org"
    password = "CallerPassword123!"
    signup_resp = client.post("/api/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": "John Dispatcher"
    })
    token = signup_resp.json()["access_token"]

    # 1. Reject unauthenticated /ws/call
    try:
        with client.websocket_connect("/ws/call") as ws:
            pytest.fail("Should have rejected unauthenticated websocket")
    except Exception:
        pass

    # 2. Connect with valid token
    with client.websocket_connect(f"/ws/call?token={token}") as ws:
        connected_msg = json.loads(ws.receive_text())
        assert connected_msg["type"] == "call_connected"
        session_id = connected_msg["session_id"]
        assert session_id.startswith("CMD-")

        # 3. Send speech-to-text transcript chunk
        ws.send_text(json.dumps({
            "type": "transcript_stream",
            "text": "Medical alert, caller is reporting severe breathing distress at Central Plaza."
        }))
        ack_msg = json.loads(ws.receive_text())
        assert ack_msg["type"] == "transcript_ack"
        assert "orchestrator" in ack_msg

        # 4. Send audio frame
        mock_payload_b64 = base64.b64encode(b"\xFF" * 160).decode("ascii")
        ws.send_text(json.dumps({
            "type": "audio",
            "payload": mock_payload_b64
        }))
        audio_reply = json.loads(ws.receive_text())
        assert audio_reply["type"] == "agent_audio"
        assert len(audio_reply["payload"]) > 0

        # 5. End call
        ws.send_text(json.dumps({"type": "end_call"}))
        ended_msg = json.loads(ws.receive_text())
        assert ended_msg["type"] == "call_ended"

    # 6. Verify call session exists in GET /api/calls/history
    history_resp = client.get("/api/calls/history")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) > 0
    # The first item should be our latest call
    latest = history[0]
    assert latest["call_id"] == session_id
    assert "breathing distress" in latest["transcript"]
    assert latest["status"] == "completed"
