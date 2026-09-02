"""Tests for Twilio voice webhooks and TwiML generation."""

from fastapi.testclient import TestClient
from app.main import create_app


def test_voice_incoming_twiml_generation():
    """Test /voice/incoming returns valid TwiML with Stream and session parameter."""
    app = create_app()
    client = TestClient(app)

    form_payload = {
        "CallSid": "CA1234567890abcdef",
        "From": "+15550001111",
        "To": "+15550002222",
    }
    response = client.post("/voice/incoming", data=form_payload)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")

    content = response.text
    assert "<Response>" in content
    assert "<Connect>" in content
    assert "<Stream" in content
    assert 'name="session_id"' in content


def test_voice_status_callback():
    """Test /voice/status callback completes active session."""
    app = create_app()
    client = TestClient(app)

    # 1. Create incoming call
    res_incoming = client.post(
        "/voice/incoming",
        data={"CallSid": "CA999888777", "From": "+111", "To": "+222"},
    )
    assert res_incoming.status_code == 200

    orchestrator = app.state.orchestrator
    sessions = list(orchestrator._sessions.values())
    assert len(sessions) > 0
    session_id = sessions[0].session_id

    # 2. Post completed status
    res_status = client.post(
        "/voice/status",
        data={"CallSid": "CA999888777", "CallStatus": "completed", "session_id": session_id},
    )
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "received"

