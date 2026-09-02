"""Tests for supervisor override, pipeline simulation, and session inspection API."""

from fastapi.testclient import TestClient
from app.main import create_app


def test_supervisor_override_and_session_api():
    """Verify POST /supervisor/override, GET /sessions/{id}, and POST /pipeline/process."""
    app = create_app()
    client = TestClient(app)

    # 1. Create call via Twilio incoming webhook
    incoming_res = client.post(
        "/voice/incoming",
        data={"CallSid": "CA_API_TEST", "From": "+19998887777", "To": "+18887776666"},
    )
    assert incoming_res.status_code == 200

    orchestrator = app.state.orchestrator
    session_id = list(orchestrator._sessions.keys())[0]

    # 2. Process a routine transcript
    process_res = client.post(
        "/pipeline/process",
        json={
            "session_id": session_id,
            "transcript": "Sir office ka address kya hai?",
            "stt_confidence": 0.95,
        },
    )
    assert process_res.status_code == 200
    assert process_res.json()["triage_result"]["route"] == "automated"

    # 3. Supervisor takeover
    override_res = client.post(
        "/supervisor/override",
        json={
            "session_id": session_id,
            "reason": "Supervisor stepping in to handle directly",
        },
    )
    assert override_res.status_code == 200
    override_data = override_res.json()
    assert override_data["session_status"] == "SUPERVISOR_CONNECTED"
    assert override_data["tts_halted"] is True

    # 4. Inspect session
    session_inspect_res = client.get(f"/sessions/{session_id}")
    assert session_inspect_res.status_code == 200
    data = session_inspect_res.json()
    assert data["session"]["status"] == "SUPERVISOR_CONNECTED"
    assert data["session"]["tts_halted"] is True
    assert len(data["events"]) >= 4  # CALL_STARTED, TRANSCRIPT_RECEIVED, INTENT_EXTRACTED, TRIAGE_COMPLETED, TTS_READY, SUPERVISOR_CONNECTED
