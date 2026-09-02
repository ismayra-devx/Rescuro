"""Common event contract for Battle Buddy."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict
import uuid
from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Allowed event types across the Battle Buddy pipeline."""

    CALL_STARTED = "CALL_STARTED"
    AUDIO_RECEIVED = "AUDIO_RECEIVED"
    TRANSCRIPT_RECEIVED = "TRANSCRIPT_RECEIVED"
    INTENT_EXTRACTED = "INTENT_EXTRACTED"
    TRIAGE_COMPLETED = "TRIAGE_COMPLETED"
    TTS_READY = "TTS_READY"
    EMERGENCY_DETECTED = "EMERGENCY_DETECTED"
    SUPERVISOR_CONNECTED = "SUPERVISOR_CONNECTED"
    CALL_ENDED = "CALL_ENDED"


class BattleBuddyEvent(BaseModel):
    """Standardized event model shared between backend and realtime/dashboard."""

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    event_type: EventType
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    payload: Dict[str, Any] = Field(default_factory=dict)
