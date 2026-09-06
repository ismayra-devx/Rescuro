"""Automated test suite for RESCURO FastAPI Backend & Vobiz Telephony Integration."""

import pytest
import os
import json
import base64
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.services import pipeline

client = TestClient(app)


# ==============================================================================
# 1. Health Check Route
# ==============================================================================

def test_health_check():
    """Verify that GET /health returns 200 with system status and telephony provider."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "RESCURO"
    assert data["telephony"] == "vobiz"
    assert "version" in data
    assert "base_ws_url" in data


# ==============================================================================
# 2. Vobiz Answer Webhook
# ==============================================================================

def test_vobiz_answer_webhook():
    """Verify POST /vobiz/answer returns valid Vobiz Voice XML with dynamic WebSocket URL."""
    response = client.post("/vobiz/answer", data={"From": "+15551234567", "CallUUID": "call_vobiz_abc"})
    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]

    xml_content = response.text
    assert "<Response>" in xml_content
    assert "</Response>" in xml_content
    assert "<Stream" in xml_content
    assert 'bidirectional="true"' in xml_content

    # Ensure stream URL uses settings.BASE_WS_URL and contains /vobiz/media
    expected_url = settings.vobiz_media_stream_url
    assert expected_url in xml_content


# ==============================================================================
# 3. Authentication Flow (Signup, Login, Token Validation)
# ==============================================================================

def test_auth_signup_and_login():
    """Verify registration and login issue valid JWT bearer tokens."""
    import time
    unique_email = f"dispatcher_{int(time.time() * 1000)}@rescuro.org"
    password = "TestDispatcherSecret123!"

    # 1. Signup
    signup_resp = client.post("/api/auth/signup", json={
        "email": unique_email,
        "password": password,
        "role": "lead_dispatcher"
    })
    assert signup_resp.status_code == 201
    signup_data = signup_resp.json()
    assert "access_token" in signup_data
    assert signup_data["user"]["email"] == unique_email
    assert signup_data["user"]["role"] == "lead_dispatcher"

    # Duplicate signup should fail
    dup_resp = client.post("/api/auth/signup", json={"email": unique_email, "password": password})
    assert dup_resp.status_code == 400

    # 2. Login
    login_resp = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": password
    })
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == unique_email

    # Invalid login password
    bad_login = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401


# ==============================================================================
# 4. Core Pipeline Stages (STT -> Orchestrator -> TTS)
# ==============================================================================

@pytest.mark.asyncio
async def test_pipeline_stages():
    """Verify STT, Orchestrator, and TTS stages execute independently and cohesively."""
    # 1. STT
    mock_audio = b"\x00\x01\x02\x03"
    transcript = await pipeline.transcribe_audio(mock_audio)
    assert isinstance(transcript, str)
    # Verifies that STT returns clean string and no fake transcript is manufactured
    assert transcript == ""

    # 2. Orchestrator
    orch = await pipeline.run_orchestrator("Fire reported on 5th floor, send firefighters immediately", session_id="sess_test")
    assert orch["category"] == "FIRE"
    assert orch["urgency"] == "HIGH"
    assert "response_text" in orch
    assert len(orch["units_assigned"]) > 0

    # 3. TTS
    tts_bytes = await pipeline.synthesize_speech(orch["response_text"])
    assert isinstance(tts_bytes, bytes)
    assert len(tts_bytes) > 0

    # 4. End-to-end turn
    full_turn = await pipeline.process_voice_turn(mock_audio, session_id="sess_full")
    assert "transcript" in full_turn
    assert "orchestrator" in full_turn
    assert "audio_bytes" in full_turn
    assert "audio_base64" in full_turn
    # Ensure audio_base64 is valid base64
    decoded = base64.b64decode(full_turn["audio_base64"])
    assert len(decoded) > 0


# ==============================================================================
# 5. Vobiz Media WebSocket Real-Time Stream
# ==============================================================================

def test_vobiz_media_websocket_flow():
    """Verify bidirectional WebSocket audio streaming on /vobiz/media."""
    with client.websocket_connect("/vobiz/media") as ws:
        # Step 1: Send 'start' event
        ws.send_text(json.dumps({
            "event": "start",
            "stream_id": "stream_vobiz_101",
            "call_id": "call_vobiz_202"
        }))

        # Step 2: Send 'media' chunk
        mock_payload_b64 = base64.b64encode(b"\xFF" * 160).decode("ascii")
        ws.send_text(json.dumps({
            "event": "media",
            "stream_id": "stream_vobiz_101",
            "media": {
                "payload": mock_payload_b64
            }
        }))

        # Step 3: Receive outbound synthesized audio from RESCURO
        response_raw = ws.receive_text()
        response_msg = json.loads(response_raw)
        assert response_msg.get("event") == "media"
        assert response_msg.get("stream_id") == "stream_vobiz_101"
        assert "payload" in response_msg.get("media", {})
        assert len(response_msg["media"]["payload"]) > 0

        # Step 4: Send 'stop' event
        ws.send_text(json.dumps({
            "event": "stop",
            "stream_id": "stream_vobiz_101"
        }))


# ==============================================================================
# 6. Authenticated Dashboard WebSocket
# ==============================================================================

def test_dashboard_websocket_auth():
    """Verify /ws/dashboard rejects unauthenticated connections and accepts valid tokens."""
    # 1. Reject without token
    try:
        with client.websocket_connect("/ws/dashboard") as ws:
            pytest.fail("WebSocket should have closed with policy violation")
    except Exception:
        pass  # Expected connection rejection

    # 2. Accept with valid token
    import time
    user_email = f"ws_user_{int(time.time() * 1000)}@rescuro.org"
    signup_resp = client.post("/api/auth/signup", json={"email": user_email, "password": "SecurePassword123!"})
    token = signup_resp.json()["access_token"]

    with client.websocket_connect(f"/ws/dashboard?token={token}") as ws:
        # Receive initial handshake
        greeting = json.loads(ws.receive_text())
        assert greeting["type"] == "CONNECTION_ESTABLISHED"
        assert greeting["payload"]["user"]["email"] == user_email

        # Send PING and receive PONG
        ws.send_text(json.dumps({"type": "PING"}))
        pong = json.loads(ws.receive_text())
        assert pong["type"] == "PONG"
