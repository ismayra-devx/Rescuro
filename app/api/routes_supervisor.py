import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field

from app.api.auth import get_current_supervisor, UserOut
from app.models.session import SessionStatus
from app.models.events import EventType
from app.services import pipeline
from app.services.audio_bridge import audio_bridge

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Supervisor & Sessions"])


class SupervisorOverrideRequest(BaseModel):
    """Payload for supervisor manual takeover."""

    session_id: str = Field(..., description="Session identifier to take over")
    reason: Optional[str] = Field(default="Supervisor initiated manual takeover")


class SupervisorReleaseRequest(BaseModel):
    """Payload for returning an overridden call back to autonomous AI."""

    session_id: str = Field(..., description="Session identifier to return to AI")
    notes: Optional[str] = Field(default="Supervisor returned call to autonomous AI")


class ProcessTranscriptRequest(BaseModel):
    """Payload for invoking or testing the transcription/triage pipeline."""

    session_id: str
    transcript: str
    stt_confidence: float = Field(default=0.9, ge=0.0, le=1.0)


@router.post("/supervisor/override")
@router.post("/api/supervisor/override")
async def supervisor_override(
    request: Request,
    body: SupervisorOverrideRequest,
    current_user: UserOut = Depends(get_current_supervisor),
) -> Dict[str, Any]:
    """Take over an active call: requires authenticated supervisor/dispatcher JWT,
    validates session_id, changes state to supervisor_connected, halts automated TTS,
    broadcasts SUPERVISOR_CONNECTED, and returns genuine media bridge connection state.
    """
    orchestrator = request.app.state.orchestrator

    # 1. Validate session_id
    if not body.session_id or not body.session_id.strip():
        raise HTTPException(status_code=422, detail="Valid session_id is required.")

    raw_call_id = body.session_id.strip()
    logger.info("SUPERVISOR TAKEOVER REQUEST")
    logger.info("DASHBOARD CALL ID: %s", raw_call_id)

    resolved_session_id = audio_bridge.resolve_session_id(raw_call_id) or raw_call_id
    logger.info("RESOLVED RESCURO SESSION ID: %s", resolved_session_id)

    session = orchestrator.get_session(resolved_session_id)
    if not session:
        session = orchestrator.get_session(raw_call_id)
    if not session:
        for s in orchestrator._sessions.values():
            if s.call_sid == resolved_session_id or s.call_sid == raw_call_id:
                session = s
                break
    if not session and len(orchestrator._sessions) == 1:
        session = next(iter(orchestrator._sessions.values()))

    if not session and not audio_bridge.has_exotel_stream(resolved_session_id):
        raise HTTPException(status_code=404, detail=f"Session '{body.session_id}' not found.")

    target_session_id = session.session_id if session else resolved_session_id
    exotel_info = audio_bridge.get_exotel_stream_info(target_session_id)
    stream_sid = exotel_info.get("stream_sid") if exotel_info else None
    logger.info("EXOTEL SESSION ID: %s", target_session_id)
    logger.info("EXOTEL STREAM SID: %s", stream_sid)

    # 2. Execute takeover & media bridge check
    override_reason = body.reason or f"Takeover by {current_user.email} [{current_user.role}]"
    if session:
        updated_session = await orchestrator.supervisor_override(
            session_id=session.session_id,
            reason=override_reason,
        )
        session.tts_halted = True
        session.supervisor_requested = True
    else:
        updated_session = None

    # 3. Mark session in core pipeline to guarantee zero race condition AI speech
    pipeline.mark_session_overridden(target_session_id, True)
    pipeline.mark_session_overridden(raw_call_id, True)

    logger.info("HUMAN_TAKEOVER ACTIVE: session=%s", target_session_id)

    # 4. Flush any currently playing TTS on caller's phone
    await audio_bridge.clear_exotel_audio(target_session_id)

    logger.info(
        "SUPERVISOR TOOK OVER call session_id=%s by %s [%s]",
        target_session_id, current_user.email, current_user.role
    )

    media_bridge = (updated_session.media_bridge if updated_session else None) or {
        "connected": bool(exotel_info),
        "stream_sid": stream_sid
    }

    # 5. Expose real connection state and supervisor audit info
    return {
        "status": "success",
        "session_id": target_session_id,
        "session_status": (updated_session.status.value if updated_session else SessionStatus.SUPERVISOR_CONNECTED.value),
        "tts_halted": True,
        "reason": override_reason,
        "supervisor": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
        },
        "media_bridge_connected": media_bridge.get("connected", False) or bool(exotel_info),
        "media_bridge": media_bridge,
    }


@router.post("/supervisor/release")
@router.post("/api/supervisor/release")
async def supervisor_release(
    request: Request,
    body: SupervisorReleaseRequest,
    current_user: UserOut = Depends(get_current_supervisor),
) -> Dict[str, Any]:
    """Release an overridden call back to autonomous AI operation.
    Requires authenticated supervisor/dispatcher JWT.
    """
    orchestrator = request.app.state.orchestrator

    raw_id = body.session_id.strip()
    resolved_id = audio_bridge.resolve_session_id(raw_id) or raw_id
    session = orchestrator.get_session(resolved_id) or orchestrator.get_session(raw_id)
    if not session:
        for s in orchestrator._sessions.values():
            if s.call_sid == resolved_id or s.call_sid == raw_id:
                session = s
                break
    if not session and len(orchestrator._sessions) == 1:
        session = next(iter(orchestrator._sessions.values()))

    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{body.session_id}' not found.")

    # Reset state
    session.tts_halted = False
    session.status = SessionStatus.ACTIVE
    session.supervisor_takeover_reason = None
    pipeline.mark_session_overridden(session.session_id, False)

    logger.info(
        "SUPERVISOR RELEASED call session_id=%s back to AI by %s [%s]",
        session.session_id, current_user.email, current_user.role
    )

    await orchestrator.supabase_service.persist_session(
        session.session_id,
        {"status": session.status.value, "tts_halted": False, "supervisor_takeover_reason": None}
    )

    await orchestrator.emit_event(
        session_id=session.session_id,
        event_type=EventType.CALL_STARTED,
        payload={
            "action": "RELEASE_TO_AI",
            "notes": body.notes,
            "supervisor": current_user.email,
            "status": session.status.value
        }
    )

    return {
        "status": "success",
        "session_id": session.session_id,
        "session_status": session.status.value,
        "tts_halted": False,
        "message": "Call successfully released back to autonomous AI",
    }


@router.get("/sessions/{session_id}")
async def get_session_details(request: Request, session_id: str) -> Dict[str, Any]:
    """Inspect session state and audit events."""
    orchestrator = request.app.state.orchestrator
    supabase_service = request.app.state.supabase_service

    session = orchestrator.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    events = await supabase_service.get_events(session_id)
    triage_records = await supabase_service.get_triage_records(session_id)
    transcripts = await supabase_service.get_transcripts(session_id)
    recordings = await supabase_service.get_recordings(session_id)

    return {
        "session": session.model_dump(),
        "events": events,
        "triage_history": triage_records,
        "transcripts": transcripts,
        "recordings": recordings,
    }


@router.post("/pipeline/process")
async def process_transcript_pipeline(
    request: Request,
    body: ProcessTranscriptRequest,
) -> Dict[str, Any]:
    """Endpoint to trigger the full processing pipeline for a transcript."""
    orchestrator = request.app.state.orchestrator
    result = await orchestrator.process_transcript(
        session_id=body.session_id,
        transcript=body.transcript,
        stt_confidence=body.stt_confidence,
    )
    return result
