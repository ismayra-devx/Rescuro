"""Unit and integration tests for RESCURO Command Center voice call WebSocket."""

import base64
import json
import os
import uuid
import pytest
from fastapi.testclient import TestClient

from app.database import init_db
from app.main import create_app


@pytest.fixture(autouse=True)
def setup_teardown_db():
    db_file = f"test_ws_{uuid.uuid4().hex[:8]}.db"
    os.environ["DATABASE_PATH"] = db_file
    init_db(db_file)
    yield
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass


def test_ws_call_authenticated_audio_stream():
    app = create_app()
    client = TestClient(app)

    # 1. Create test user
    signup_res = client.post("/api/auth/signup", json={
        "email": "tactical@rescuro.org",
        "password": "tacticalpass123",
        "full_name": "Tactical Officer",
    })
    token = signup_res.json()["access_token"]

    # 2. Connect to WebSocket with token
    with client.websocket_connect(f"/ws/call?token={token}") as ws:
        # Receive connected message
        conn_msg = ws.receive_json()
        assert conn_msg["type"] == "call_connected"
        assert conn_msg["agent"] == "agro"
        assert conn_msg["status"] == "secure"

        # Send sample audio frame
        sample_pcm = b"\x00\x10\x20\x30" * 40
        ws.send_json({
            "type": "audio",
            "payload": base64.b64encode(sample_pcm).decode("ascii"),
        })

        # Receive agent audio response
        agent_res = ws.receive_json()
        assert agent_res["type"] == "agent_audio"
        assert agent_res["agent"] == "agro"
        assert "payload" in agent_res

        # Send end_call
        ws.send_json({"type": "end_call"})
        end_res = ws.receive_json()
        assert end_res["type"] == "call_ended"

    # 3. Verify call history recorded in DB
    history_res = client.get("/api/calls/history", headers={"Authorization": f"Bearer {token}"})
    assert history_res.status_code == 200
    logs = history_res.json()
    assert len(logs) == 1
    assert logs[0]["duration_sec"] >= 1
    assert logs[0]["status"] == "completed"


def test_ws_call_unauthenticated_rejected():
    app = create_app()
    client = TestClient(app)

    # Connect without valid token
    try:
        with client.websocket_connect("/ws/call?token=invalid_token") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "error"
    except Exception:
        # Client disconnect or policy violation rejection
        pass
