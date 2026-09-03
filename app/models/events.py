"""Common event contract for EchoSphere."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict
import uuid
from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Allowed event types across the EchoSphere pipeline."""

    # Core Pipeline Events
    CALL_STARTED = "CALL_STARTED"
    AUDIO_RECEIVED = "AUDIO_RECEIVED"
    TRANSCRIPT_RECEIVED = "TRANSCRIPT_RECEIVED"
    INTENT_EXTRACTED = "INTENT_EXTRACTED"
    TRIAGE_COMPLETED = "TRIAGE_COMPLETED"
    TTS_READY = "TTS_READY"
    EMERGENCY_DETECTED = "EMERGENCY_DETECTED"
    SUPERVISOR_CONNECTED = "SUPERVISOR_CONNECTED"
    CALL_ENDED = "CALL_ENDED"

    # Dashboard Canonical Aliases
    NEW_CALL = "NEW_CALL"
    TRANSCRIPT_UPDATE = "TRANSCRIPT_UPDATE"
    TRIAGE_UPDATE = "TRIAGE_UPDATE"
    EMERGENCY_ALERT = "EMERGENCY_ALERT"
    CALL_STATUS = "CALL_STATUS"


EVENT_ALIAS_MAP: Dict[EventType, str] = {
    EventType.CALL_STARTED: "NEW_CALL",
    EventType.TRANSCRIPT_RECEIVED: "TRANSCRIPT_UPDATE",
    EventType.TRIAGE_COMPLETED: "TRIAGE_UPDATE",
    EventType.EMERGENCY_DETECTED: "EMERGENCY_ALERT",
    EventType.SUPERVISOR_CONNECTED: "SUPERVISOR_CONNECTED",
    EventType.CALL_ENDED: "CALL_ENDED",
}


class EchoSphereEvent(BaseModel):
    """Standardized event model shared between backend and realtime/dashboard."""

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    event_type: EventType
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    payload: Dict[str, Any] = Field(default_factory=dict)


# Backwards compatibility alias
BattleBuddyEvent = EchoSphereEvent
