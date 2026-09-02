"""Session state and registry models."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class SessionStatus(str, Enum):
    """Lifecycle states for a call session."""

    INITIATED = "INITIATED"
    ACTIVE = "ACTIVE"
    SUPERVISOR_CONNECTED = "SUPERVISOR_CONNECTED"
    COMPLETED = "COMPLETED"


class CallSession(BaseModel):
    """In-memory representation of an active or historical call session."""

    session_id: str
    call_sid: Optional[str] = None
    status: SessionStatus = SessionStatus.INITIATED
    from_number: Optional[str] = None
    to_number: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    latest_transcript: Optional[str] = None
    latest_triage: Optional[Dict[str, Any]] = None
    tts_halted: bool = False
    supervisor_takeover_reason: Optional[str] = None
