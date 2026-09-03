"""Supervisor override and session inspection routes."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(tags=["Supervisor & Sessions"])


class SupervisorOverrideRequest(BaseModel):
    """Payload for supervisor manual takeover."""

    session_id: str = Field(..., description="Session identifier to take over")
    reason: Optional[str] = Field(default="Supervisor initiated manual takeover")


class ProcessTranscriptRequest(BaseModel):
    """Payload for invoking or testing the transcription/triage pipeline."""

    session_id: str
    transcript: str
    stt_confidence: float = Field(default=0.9, ge=0.0, le=1.0)


@router.post("/supervisor/override")
async def supervisor_override(request: Request, body: SupervisorOverrideRequest) -> Dict[str, Any]:
    """Take over an active call: validates session_id, changes state to supervisor_connected,
    halts automated TTS, broadcasts SUPERVISOR_CONNECTED, and returns genuine media bridge connection state.
    """
    orchestrator = request.app.state.orchestrator

    # 1. Validate session_id
    if not body.session_id or not body.session_id.strip():
        raise HTTPException(status_code=422, detail="Valid session_id is required.")

    session = orchestrator.get_session(body.session_id.strip())
    if not session:
        for s in orchestrator._sessions.values():
            if s.call_sid == body.session_id.strip():
                session = s
                break

    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{body.session_id}' not found.")

    # 2. Execute takeover & media bridge check
    updated_session = await orchestrator.supervisor_override(
        session_id=session.session_id,
        reason=body.reason,
    )

    media_bridge = updated_session.media_bridge or {}

    # 3. Expose real connection state without faking audio bridge success
    return {
        "status": "success",
        "session_id": updated_session.session_id,
        "session_status": updated_session.status.value,
        "tts_halted": updated_session.tts_halted,
        "reason": updated_session.supervisor_takeover_reason,
        "media_bridge_connected": media_bridge.get("connected", False),
        "media_bridge": media_bridge,
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
