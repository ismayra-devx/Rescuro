"""Golden End-to-End integration tests for Battle Buddy pipeline."""

import pytest
from app.models.events import EventType
from app.models.session import SessionStatus
from app.orchestrator import BattleBuddyOrchestrator
from app.services.openai_service import OpenAIService
from app.services.supabase_service import SupabaseService
from app.services.tts_service import TTSService


@pytest.mark.asyncio
async def test_golden_path_routine_automated_tts():
    """Golden Test 1: Routine query -> confidence > .8 -> automated -> TTS synthesized."""
    supabase = SupabaseService()
    tts = TTSService()
    openai = OpenAIService()
    orchestrator = BattleBuddyOrchestrator(
        openai_service=openai,
        supabase_service=supabase,
        tts_service=tts,
    )

    captured_events = []
    orchestrator.subscribe(lambda ev: captured_events.append(ev))

    # 1. Start call session
    session = await orchestrator.create_session(call_sid="CA_ROUTINE_01")
    assert session.status == SessionStatus.ACTIVE

    # 2. Process routine transcript
    result = await orchestrator.process_transcript(
        session_id=session.session_id,
        transcript="Sir office ka address kya hai?",
        stt_confidence=0.95,
    )

    # 3. Assertions
    assert result["triage_result"]["route"] == "automated"
    assert result["triage_result"]["combined_confidence"] > 0.80

    # Verify TTS played
    last_spoken = tts.get_last_played(session.session_id)
    assert last_spoken is not None
    assert "Sector 62" in last_spoken or "office" in last_spoken.lower()

    # Verify event contract progression
    event_types = [e.event_type for e in captured_events]
    assert EventType.CALL_STARTED in event_types
    assert EventType.TRANSCRIPT_RECEIVED in event_types
    assert EventType.INTENT_EXTRACTED in event_types
    assert EventType.TRIAGE_COMPLETED in event_types
    assert EventType.TTS_READY in event_types


@pytest.mark.asyncio
async def test_golden_path_hinglish_emergency_human_supervisor():
    """Golden Test 2: Hinglish emergency -> human supervisor -> emergency alert + Supabase persistence."""
    supabase = SupabaseService()
    tts = TTSService()
    openai = OpenAIService()
    orchestrator = BattleBuddyOrchestrator(
        openai_service=openai,
        supabase_service=supabase,
        tts_service=tts,
    )

    captured_events = []
    orchestrator.subscribe(lambda ev: captured_events.append(ev))

    session = await orchestrator.create_session(call_sid="CA_EMERGENCY_02")

    # Process Hinglish emergency transcript
    result = await orchestrator.process_transcript(
        session_id=session.session_id,
        transcript="Sir highway pe accident hua hai, ek banda injured hai.",
        stt_confidence=0.92,
    )

    # Assertions
    assert result["triage_result"]["route"] == "human_supervisor"
    assert result["triage_result"]["priority"] in ["HIGH", "CRITICAL"]

    # Verify EMERGENCY_DETECTED event was emitted
    event_types = [e.event_type for e in captured_events]
    assert EventType.EMERGENCY_DETECTED in event_types

    # Automated TTS should NOT be triggered
    assert EventType.TTS_READY not in event_types

    # Verify Supabase audit trail
    persisted_events = await supabase.get_events(session.session_id)
    assert len(persisted_events) > 0
    triage_records = await supabase.get_triage_records(session.session_id)
    assert len(triage_records) > 0
    assert triage_records[0]["route"] == "human_supervisor"


@pytest.mark.asyncio
async def test_golden_keyword_override_bachao():
    """Golden Test: High confidence score overridden by 'bachao' keyword -> human_supervisor."""
    orchestrator = BattleBuddyOrchestrator()
    session = await orchestrator.create_session()

    result = await orchestrator.process_transcript(
        session_id=session.session_id,
        transcript="Jaldi aao mujhe bachao please!",
        stt_confidence=0.98,
    )

    assert result["triage_result"]["route"] == "human_supervisor"
    assert "bachao" in result["triage_result"]["matched_keywords"]


@pytest.mark.asyncio
async def test_golden_supervisor_takeover_halts_tts():
    """Golden Test 8: Supervisor TAKE OVER changes state to supervisor_connected and halts automated TTS."""
    supabase = SupabaseService()
    tts = TTSService()
    orchestrator = BattleBuddyOrchestrator(
        supabase_service=supabase,
        tts_service=tts,
    )

    captured_events = []
    orchestrator.subscribe(lambda ev: captured_events.append(ev))

    # 1. Create session
    session = await orchestrator.create_session()

    # 2. Supervisor initiates override
    updated = await orchestrator.supervisor_override(
        session_id=session.session_id,
        reason="Supervisor intervenes to assist caller",
    )
    assert updated.status == SessionStatus.SUPERVISOR_CONNECTED
    assert updated.tts_halted is True

    # 3. Verify event emitted
    assert any(e.event_type == EventType.SUPERVISOR_CONNECTED for e in captured_events)

    # 4. Now process a routine message that would normally trigger TTS
    result = await orchestrator.process_transcript(
        session_id=session.session_id,
        transcript="Sir office ka address kya hai?",
        stt_confidence=0.95,
    )

    # TTS must be suppressed
    assert any(e.event_type == EventType.TTS_READY for e in captured_events) is False
