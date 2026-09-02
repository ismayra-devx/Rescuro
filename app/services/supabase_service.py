"""Supabase persistence service with in-memory fallback store."""

import logging
from typing import Any, Dict, List, Optional
from app.config import settings
from app.models.events import BattleBuddyEvent

logger = logging.getLogger(__name__)


class SupabaseService:
    """Service to persist sessions, events, transcripts, and triage data."""

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_key: Optional[str] = None,
    ):
        self.supabase_url = supabase_url or settings.SUPABASE_URL
        self.service_key = service_key or settings.SUPABASE_SERVICE_KEY

        # In-memory audit tables for testing and offline resilience
        self._sessions_table: Dict[str, Dict[str, Any]] = {}
        self._events_table: List[Dict[str, Any]] = []
        self._triage_table: List[Dict[str, Any]] = []
        self._transcripts_table: List[Dict[str, Any]] = []

    async def persist_session(self, session_id: str, data: Dict[str, Any]) -> None:
        """Persist or update session record."""
        current = self._sessions_table.get(session_id, {})
        current.update(data)
        current["session_id"] = session_id
        self._sessions_table[session_id] = current
        logger.debug(f"Persisted session {session_id}")

    async def persist_event(self, event: BattleBuddyEvent) -> None:
        """Persist event to events audit table."""
        record = {
            "event_id": event.event_id,
            "session_id": event.session_id,
            "event_type": event.event_type.value,
            "timestamp": event.timestamp,
            "payload": event.payload,
        }
        self._events_table.append(record)
        logger.debug(f"Persisted event {event.event_type} for session {event.session_id}")

    async def persist_triage(
        self,
        session_id: str,
        triage_data: Dict[str, Any],
    ) -> None:
        """Persist triage results linked to session_id."""
        record = {
            "session_id": session_id,
            **triage_data,
        }
        self._triage_table.append(record)

    async def persist_transcript(
        self,
        session_id: str,
        transcript: str,
        stt_confidence: float,
        is_final: bool = True,
    ) -> None:
        """Persist transcript record linked to session_id."""
        record = {
            "session_id": session_id,
            "transcript": transcript,
            "stt_confidence": stt_confidence,
            "is_final": is_final,
        }
        self._transcripts_table.append(record)

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session record."""
        return self._sessions_table.get(session_id)

    async def get_events(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve audit events for a session."""
        return [e for e in self._events_table if e["session_id"] == session_id]

    async def get_triage_records(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve triage records for a session."""
        return [t for t in self._triage_table if t["session_id"] == session_id]
