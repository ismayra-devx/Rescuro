"""Smoke test for Supabase persistence service.

Verifies the minimum 5 tables:
- sessions (session state, status, tts_halted, takeover reason)
- transcripts (final transcripts, STT confidence)
- triage_events (triage scores, route, escalation reason)
- events (Critical Event Contract)
- recordings (audio recording storage path)

Confirms that every child record references session_id,
and validates insert/read operations across all 5 tables.
"""

import pytest
from app.models.events import BattleBuddyEvent, EventType
from app.services.supabase_service import SupabaseService


@pytest.mark.asyncio
async def test_supabase_minimum_tables_insert_read_smoke():
    """Smoke test: insert and read across sessions, transcripts, triage_events, events, and recordings."""
    service = SupabaseService()
    session_id = "test_smoke_session_001"

    # =========================================================================
    # 1. SESSIONS: Persist and read session state
    # =========================================================================
    session_data = {
        "call_sid": "CA_SMOKE_123456",
        "from_number": "+1234567890",
        "to_number": "+1987654321",
        "status": "ACTIVE",
        "tts_halted": False,
        "supervisor_takeover_reason": "Escalation requested by field triage",
    }
    persisted_session = await service.persist_session(session_id, session_data)
    assert persisted_session["session_id"] == session_id
    assert persisted_session["status"] == "ACTIVE"

    read_session = await service.get_session(session_id)
    assert read_session is not None
    assert read_session["session_id"] == session_id
    assert read_session["call_sid"] == "CA_SMOKE_123456"
    assert read_session["status"] == "ACTIVE"
    assert read_session["tts_halted"] is False
    assert read_session["supervisor_takeover_reason"] == "Escalation requested by field triage"

    # =========================================================================
    # 2. TRANSCRIPTS: Persist and read final transcript & STT confidence
    # =========================================================================
    transcript_text = "Sir highway pe emergency ho gayi hai, accident hua hai!"
    stt_conf = 0.945
    transcript_record = await service.persist_transcript(
        session_id=session_id,
        transcript=transcript_text,
        stt_confidence=stt_conf,
        is_final=True,
    )
    assert transcript_record["session_id"] == session_id
    assert transcript_record["is_final"] is True

    read_transcripts = await service.get_transcripts(session_id)
    assert len(read_transcripts) == 1
    assert read_transcripts[0]["session_id"] == session_id
    assert read_transcripts[0]["transcript"] == transcript_text
    assert read_transcripts[0]["stt_confidence"] == pytest.approx(0.945, rel=1e-3)
    assert read_transcripts[0]["is_final"] is True

    # =========================================================================
    # 3. TRIAGE_EVENTS: Persist and read triage scores, route & escalation reason
    # =========================================================================
    triage_payload = {
        "route": "human_supervisor",
        "priority": "HIGH",
        "combined_confidence": 0.885,
        "stt_confidence": 0.945,
        "llm_confidence": 0.825,
        "reason": "High-risk keyword(s) detected: accident, emergency",
        "matched_keywords": ["accident", "emergency"],
    }
    triage_record = await service.persist_triage(session_id, triage_payload)
    assert triage_record["session_id"] == session_id

    read_triage = await service.get_triage_records(session_id)
    assert len(read_triage) == 1
    assert read_triage[0]["session_id"] == session_id
    assert read_triage[0]["route"] == "human_supervisor"
    assert read_triage[0]["priority"] == "HIGH"
    assert read_triage[0]["combined_confidence"] == pytest.approx(0.885, rel=1e-3)
    assert read_triage[0]["stt_confidence"] == pytest.approx(0.945, rel=1e-3)
    assert read_triage[0]["llm_confidence"] == pytest.approx(0.825, rel=1e-3)
    assert "High-risk keyword(s) detected: accident" in read_triage[0]["reason"]
    assert "emergency" in read_triage[0]["matched_keywords"]

    # =========================================================================
    # 4. EVENTS: Persist and read audit events
    # =========================================================================
    event = BattleBuddyEvent(
        event_id="EVT_SMOKE_7788",
        session_id=session_id,
        event_type=EventType.EMERGENCY_DETECTED,
        payload={"alert": "Critical supervisor dispatched", "level": "tier_1"},
    )
    persisted_event = await service.persist_event(event)
    assert persisted_event["session_id"] == session_id

    read_events = await service.get_events(session_id)
    assert len(read_events) == 1
    assert read_events[0]["session_id"] == session_id
    assert read_events[0]["event_id"] == "EVT_SMOKE_7788"
    assert read_events[0]["event_type"] == "EMERGENCY_DETECTED"
    assert read_events[0]["payload"]["alert"] == "Critical supervisor dispatched"

    # =========================================================================
    # 5. RECORDINGS: Persist and read recording path
    # =========================================================================
    rec_path = "s3://rescuro-audio-vault/2026/09/03/rec_test_smoke_001.wav"
    rec_record = await service.persist_recording(
        session_id=session_id,
        recording_path=rec_path,
        duration_seconds=34.8,
        channels=1,
    )
    assert rec_record["session_id"] == session_id
    assert rec_record["recording_path"] == rec_path

    read_recordings = await service.get_recordings(session_id)
    assert len(read_recordings) == 1
    assert read_recordings[0]["session_id"] == session_id
    assert read_recordings[0]["recording_path"] == rec_path
    assert read_recordings[0]["duration_seconds"] == pytest.approx(34.8, rel=1e-2)

    # =========================================================================
    # 6. RELATIONAL INTEGRITY VERIFICATION:
    # Verify every child record strictly references session_id
    # =========================================================================
    for child_transcript in read_transcripts:
        assert child_transcript["session_id"] == session_id
    for child_triage in read_triage:
        assert child_triage["session_id"] == session_id
    for child_event in read_events:
        assert child_event["session_id"] == session_id
    for child_recording in read_recordings:
        assert child_recording["session_id"] == session_id

    # =========================================================================
    # 7. CASCADE CLEANUP
    # =========================================================================
    await service.delete_session(session_id)
    assert await service.get_session(session_id) is None
    assert len(await service.get_transcripts(session_id)) == 0
    assert len(await service.get_triage_records(session_id)) == 0
    assert len(await service.get_events(session_id)) == 0
    assert len(await service.get_recordings(session_id)) == 0
