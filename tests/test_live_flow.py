"""Comprehensive end-to-end integration and sanity test."""

from fastapi.testclient import TestClient
from app.main import create_app
from app.models.events import EventType


def test_complete_live_lifecycle_flow():
    """Verify complete end-to-end flow from Twilio webhook through triage to supervisor takeover."""
    app = create_app()
    client = TestClient(app)

    # 1. Health check
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    # 2. Twilio incoming call
    res_voice = client.post(
        "/voice/incoming",
        data={
            "CallSid": "CA_SANITY_101",
            "From": "+1234567890",
            "To": "+1098765432",
        },
    )
    assert res_voice.status_code == 200
    assert res_voice.headers["content-type"].startswith("application/xml")
    assert "<Response>" in res_voice.text
    assert "<Stream" in res_voice.text
    assert 'name="session_id"' in res_voice.text

    # 3. Retrieve session
    orchestrator = app.state.orchestrator
    session_id = list(orchestrator._sessions.keys())[0]

    # 4. Pipeline processing - Routine
    res_routine = client.post(
        "/pipeline/process",
        json={
            "session_id": session_id,
            "transcript": "Sir office ka address kya hai?",
            "stt_confidence": 0.95,
        },
    )
    assert res_routine.status_code == 200
    data_routine = res_routine.json()
    assert data_routine["triage_result"]["route"] == "automated"
    assert data_routine["triage_result"]["combined_confidence"] > 0.80

    # 5. Pipeline processing - Emergency
    res_emerg = client.post(
        "/pipeline/process",
        json={
            "session_id": session_id,
            "transcript": "Sir highway pe accident hua hai, ek banda injured hai.",
            "stt_confidence": 0.92,
        },
    )
    assert res_emerg.status_code == 200
    data_emerg = res_emerg.json()
    assert data_emerg["triage_result"]["route"] == "human_supervisor"
    assert data_emerg["triage_result"]["priority"] in ["HIGH", "CRITICAL"]

    # 6. Supervisor takeover
    res_override = client.post(
        "/supervisor/override",
        json={
            "session_id": session_id,
            "reason": "Supervisor taking over call",
        },
    )
    assert res_override.status_code == 200
    data_override = res_override.json()
    assert data_override["session_status"] == "SUPERVISOR_CONNECTED"
    assert data_override["tts_halted"] is True

    # 7. Audit trail verification in Supabase
    res_session = client.get(f"/sessions/{session_id}")
    assert res_session.status_code == 200
    audit = res_session.json()
    assert audit["session"]["status"] == "SUPERVISOR_CONNECTED"
    assert len(audit["events"]) >= 5
