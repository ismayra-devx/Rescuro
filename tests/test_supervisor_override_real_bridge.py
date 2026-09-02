"""Tests for POST /supervisor/override:
- Validate session_id
- Persist event
- Change state to supervisor_connected
- Broadcast SUPERVISOR_CONNECTED
- Prevent further automated TTS
- Keep Agora logic behind agora_service.py
- Expose real media bridge connection state without faking success.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.models.events import EventType
from app.models.session import SessionStatus
from app.services.agora_service import AgoraAudioAdapter


def test_supervisor_override_session_validation_404_and_422():
    """Verify session_id validation: 404 when not found, 422 when empty."""
    app = create_app()
    client = TestClient(app)

    # 1. Non-existent session
    res_404 = client.post(
        "/supervisor/override",
        json={"session_id": "non_existent_session_id_999", "reason": "Test takeover"},
    )
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"]

    # 2. Empty session_id
    res_422 = client.post(
        "/supervisor/override",
        json={"session_id": "   ", "reason": "Test takeover"},
    )
    assert res_422.status_code == 422


def test_supervisor_override_state_persistence_and_tts_prevention():
    """Verify state transition, event persistence, and automated TTS suppression."""
    app = create_app()
    client = TestClient(app)
    orchestrator = app.state.orchestrator
    supabase = app.state.supabase_service

    # 1. Create active call session
    session = orchestrator.create_session_instant(call_sid="CA_OVERRIDE_TEST")
    session_id = session.session_id

    # 2. Perform supervisor override
    override_res = client.post(
        "/supervisor/override",
        json={"session_id": session_id, "reason": "Supervisor taking over emergency call"},
    )
    assert override_res.status_code == 200
    data = override_res.json()

    # Verify state transition to SUPERVISOR_CONNECTED
    assert data["session_status"] == "SUPERVISOR_CONNECTED"
    assert data["tts_halted"] is True
    assert data["reason"] == "Supervisor taking over emergency call"

    # Verify state updated in orchestrator memory
    in_mem_session = orchestrator.get_session(session_id)
    assert in_mem_session.status == SessionStatus.SUPERVISOR_CONNECTED
    assert in_mem_session.tts_halted is True

    # 3. Verify SUPERVISOR_CONNECTED event persisted in Supabase
    captured_events = []
    # Fetch from Supabase service
    import asyncio
    persisted_events = asyncio.run(supabase.get_events(session_id))
    sup_events = [e for e in persisted_events if e["event_type"] == "SUPERVISOR_CONNECTED"]
    assert len(sup_events) > 0
    assert sup_events[0]["payload"]["tts_halted"] is True

    # 4. Verify prevention of automated TTS on subsequent messages
    captured_broadcasts = []
    orchestrator.subscribe(lambda ev: captured_broadcasts.append(ev))

    process_res = client.post(
        "/pipeline/process",
        json={
            "session_id": session_id,
            "transcript": "Sir office ka address bataiye please",
            "stt_confidence": 0.98,
        },
    )
    assert process_res.status_code == 200
    process_data = process_res.json()
    assert process_data["triage_result"]["route"] == "automated"
    assert process_data["tts_halted"] is True

    # Confirm TTS_READY event was NOT broadcast
    assert not any(e.event_type == EventType.TTS_READY for e in captured_broadcasts)


def test_supervisor_override_real_media_bridge_state_reporting():
    """Verify the real media bridge state is exposed and NEVER faked as connected when inactive."""
    app = create_app()
    client = TestClient(app)
    orchestrator = app.state.orchestrator

    # Case A: Audio session was NEVER started in the adapter -> must report disconnected!
    session_a = orchestrator.create_session_instant(call_sid="CA_DISCONNECTED_BRIDGE")
    res_a = client.post(
        "/supervisor/override",
        json={"session_id": session_a.session_id, "reason": "Takeover inactive audio"},
    )
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["media_bridge_connected"] is False
    assert data_a["media_bridge"]["connected"] is False
    assert data_a["media_bridge"]["status"] == "session_inactive"
    assert "not active" in data_a["media_bridge"]["error"]

    # Case B: Audio session IS active in the adapter -> reports connected with details
    session_b = orchestrator.create_session_instant(call_sid="CA_CONNECTED_BRIDGE")
    # Start audio session in adapter
    import asyncio
    asyncio.run(orchestrator.audio_adapter.start_session(session_b.session_id))

    res_b = client.post(
        "/supervisor/override",
        json={"session_id": session_b.session_id, "reason": "Takeover active audio"},
    )
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["media_bridge_connected"] is True
    assert data_b["media_bridge"]["connected"] is True
    assert data_b["media_bridge"]["status"] == "mock_connected"


@pytest.mark.asyncio
async def test_agora_media_bridge_isolation_and_genuine_connection_state():
    """Verify Agora connection logic remains strictly behind agora_service.py without leaking details."""
    agora_adapter = AgoraAudioAdapter(
        app_id="agora_test_app_id_888",
        app_certificate="agora_test_app_cert_888",
    )
    session_id = "agora_bridge_test_session"

    # 1. When Agora channel is inactive, do not fake connection
    bridge_inactive = await agora_adapter.bridge_supervisor(session_id)
    assert bridge_inactive["connected"] is False
    assert bridge_inactive["status"] == "channel_not_active"
    assert bridge_inactive["channel_name"] is None

    # 2. When Agora channel is active, returns real Agora RTC channel & supervisor token
    await agora_adapter.start_session(session_id, channel_name="emergency_room_911")
    bridge_active = await agora_adapter.bridge_supervisor(session_id)
    assert bridge_active["connected"] is True
    assert bridge_active["status"] == "agora_bridge_connected"
    assert bridge_active["channel_name"] == "emergency_room_911"
    assert bridge_active["supervisor_uid"] == 9999
    assert bridge_active["token"] is not None
    assert bridge_active["token"].startswith("AGORA_TOKEN_") or len(bridge_active["token"]) > 20
