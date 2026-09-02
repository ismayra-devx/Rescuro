"""Supabase persistence service with server-side credentials and in-memory fallback.

Manages the minimum 5 relational tables:
- sessions (session state, takeover reasons, status)
- transcripts (final transcripts, STT confidence)
- triage_events (triage scores, route, escalation reason)
- events (event contract lifecycle)
- recordings (audio recording paths)

Every child table references session_id. All database operations
are kept strictly inside this service module.
"""

import logging
import time
from typing import Any, Dict, List, Optional
import uuid
import httpx

from app.config import settings
from app.models.events import BattleBuddyEvent

logger = logging.getLogger(__name__)


class SupabaseService:
    """Service to persist and query sessions, transcripts, triage_events, events, and recordings."""

    PLACEHOLDER_URLS = {"https://your-project.supabase.co", "", None}
    PLACEHOLDER_KEYS = {"your_supabase_service_role_key", "", None}

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_key: Optional[str] = None,
    ):
        self.supabase_url = (supabase_url or settings.SUPABASE_URL or "").rstrip("/")
        self.service_key = service_key or settings.SUPABASE_SERVICE_KEY

        self._is_live_configured = bool(
            self.supabase_url
            and self.supabase_url not in self.PLACEHOLDER_URLS
            and self.service_key
            and self.service_key not in self.PLACEHOLDER_KEYS
        )

        # In-memory relational tables (for testing, local dev, or offline fallback)
        self._sessions_table: Dict[str, Dict[str, Any]] = {}
        self._transcripts_table: List[Dict[str, Any]] = []
        self._triage_table: List[Dict[str, Any]] = []
        self._events_table: List[Dict[str, Any]] = []
        self._recordings_table: List[Dict[str, Any]] = []

        if self._is_live_configured:
            logger.info("SupabaseService initialized with live backend server-side credentials.")
        else:
            logger.info("SupabaseService running in local/test mode with in-memory persistence store.")

    @property
    def is_live_configured(self) -> bool:
        """Indicate whether live remote Supabase credentials are configured."""
        return self._is_live_configured

    def _get_headers(self) -> Dict[str, str]:
        """Server-side authorization headers using service role key."""
        return {
            "apikey": self.service_key,  # type: ignore
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    # =========================================================================
    # 1. SESSIONS TABLE
    # =========================================================================
    async def persist_session(self, session_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Persist or update session state record."""
        current = self._sessions_table.get(session_id, {})
        current.update(data)
        current["session_id"] = session_id
        current.setdefault("status", "ACTIVE")
        current.setdefault("tts_halted", False)
        current.setdefault("supervisor_takeover_reason", None)
        current.setdefault("created_at", time.time())
        current["updated_at"] = time.time()
        self._sessions_table[session_id] = current

        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{self.supabase_url}/rest/v1/sessions",
                        headers={**self._get_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
                        json=current,
                    )
            except Exception as exc:
                logger.warning(f"Live Supabase persist_session failed ({exc}), falling back to memory.")

        logger.debug(f"Persisted session {session_id} state={current.get('status')}")
        return current

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session record by session_id."""
        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.get(
                        f"{self.supabase_url}/rest/v1/sessions?session_id=eq.{session_id}",
                        headers=self._get_headers(),
                    )
                    if res.status_code == 200:
                        rows = res.json()
                        if rows:
                            return rows[0]
            except Exception as exc:
                logger.warning(f"Live Supabase get_session failed ({exc}), using memory.")

        return self._sessions_table.get(session_id)

    # =========================================================================
    # 2. TRANSCRIPTS TABLE (Child: references session_id)
    # =========================================================================
    async def persist_transcript(
        self,
        session_id: str,
        transcript: str,
        stt_confidence: float,
        is_final: bool = True,
    ) -> Dict[str, Any]:
        """Persist final transcript and STT confidence linked to session_id."""
        record = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "transcript": transcript,
            "stt_confidence": float(stt_confidence),
            "is_final": is_final,
            "created_at": time.time(),
        }
        self._transcripts_table.append(record)

        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{self.supabase_url}/rest/v1/transcripts",
                        headers=self._get_headers(),
                        json=record,
                    )
            except Exception as exc:
                logger.warning(f"Live Supabase persist_transcript failed ({exc}), using memory.")

        logger.debug(f"Persisted transcript for session {session_id} (confidence: {stt_confidence})")
        return record

    async def get_transcripts(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve all transcripts for a session."""
        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.get(
                        f"{self.supabase_url}/rest/v1/transcripts?session_id=eq.{session_id}&order=created_at.asc",
                        headers=self._get_headers(),
                    )
                    if res.status_code == 200:
                        return res.json()
            except Exception as exc:
                logger.warning(f"Live Supabase get_transcripts failed ({exc}), using memory.")

        return [t for t in self._transcripts_table if t["session_id"] == session_id]

    # =========================================================================
    # 3. TRIAGE_EVENTS TABLE (Child: references session_id)
    # =========================================================================
    async def persist_triage(
        self,
        session_id: str,
        triage_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Persist triage scores, route decision, and escalation reason linked to session_id."""
        record = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "route": triage_data.get("route", "automated"),
            "priority": triage_data.get("priority", "NORMAL"),
            "combined_confidence": float(triage_data.get("combined_confidence", 0.0)),
            "stt_confidence": float(triage_data.get("stt_confidence", 0.0)),
            "llm_confidence": float(triage_data.get("llm_confidence", 0.0)),
            "reason": triage_data.get("reason", "Routine query"),
            "matched_keywords": triage_data.get("matched_keywords", []),
            "created_at": time.time(),
        }
        self._triage_table.append(record)

        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{self.supabase_url}/rest/v1/triage_events",
                        headers=self._get_headers(),
                        json=record,
                    )
            except Exception as exc:
                logger.warning(f"Live Supabase persist_triage failed ({exc}), using memory.")

        logger.debug(f"Persisted triage for session {session_id} route={record['route']} reason={record['reason']}")
        return record

    async def get_triage_records(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve triage records for a session."""
        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.get(
                        f"{self.supabase_url}/rest/v1/triage_events?session_id=eq.{session_id}&order=created_at.asc",
                        headers=self._get_headers(),
                    )
                    if res.status_code == 200:
                        return res.json()
            except Exception as exc:
                logger.warning(f"Live Supabase get_triage_records failed ({exc}), using memory.")

        return [t for t in self._triage_table if t["session_id"] == session_id]

    # Alias for explicit naming
    get_triage_events = get_triage_records

    # =========================================================================
    # 4. EVENTS TABLE (Child: references session_id)
    # =========================================================================
    async def persist_event(self, event: BattleBuddyEvent) -> Dict[str, Any]:
        """Persist audit event strictly linked to session_id."""
        record = {
            "id": str(uuid.uuid4()),
            "event_id": event.event_id,
            "session_id": event.session_id,
            "event_type": event.event_type.value,
            "timestamp": str(event.timestamp),
            "payload": event.payload,
            "created_at": time.time(),
        }
        self._events_table.append(record)

        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{self.supabase_url}/rest/v1/events",
                        headers=self._get_headers(),
                        json=record,
                    )
            except Exception as exc:
                logger.warning(f"Live Supabase persist_event failed ({exc}), using memory.")

        logger.debug(f"Persisted event {event.event_type} for session {event.session_id}")
        return record

    async def get_events(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve audit events for a session."""
        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.get(
                        f"{self.supabase_url}/rest/v1/events?session_id=eq.{session_id}&order=created_at.asc",
                        headers=self._get_headers(),
                    )
                    if res.status_code == 200:
                        return res.json()
            except Exception as exc:
                logger.warning(f"Live Supabase get_events failed ({exc}), using memory.")

        return [e for e in self._events_table if e["session_id"] == session_id]

    # =========================================================================
    # 5. RECORDINGS TABLE (Child: references session_id)
    # =========================================================================
    async def persist_recording(
        self,
        session_id: str,
        recording_path: str,
        duration_seconds: Optional[float] = None,
        channels: int = 1,
    ) -> Dict[str, Any]:
        """Persist recording storage path linked to session_id."""
        record = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "recording_path": recording_path,
            "duration_seconds": float(duration_seconds) if duration_seconds is not None else None,
            "channels": channels,
            "created_at": time.time(),
        }
        self._recordings_table.append(record)

        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(
                        f"{self.supabase_url}/rest/v1/recordings",
                        headers=self._get_headers(),
                        json=record,
                    )
            except Exception as exc:
                logger.warning(f"Live Supabase persist_recording failed ({exc}), using memory.")

        logger.debug(f"Persisted recording for session {session_id} (path: {recording_path})")
        return record

    async def get_recordings(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve all recordings for a session."""
        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    res = await client.get(
                        f"{self.supabase_url}/rest/v1/recordings?session_id=eq.{session_id}&order=created_at.asc",
                        headers=self._get_headers(),
                    )
                    if res.status_code == 200:
                        return res.json()
            except Exception as exc:
                logger.warning(f"Live Supabase get_recordings failed ({exc}), using memory.")

        return [r for r in self._recordings_table if r["session_id"] == session_id]

    # =========================================================================
    # CLEANUP UTILITY
    # =========================================================================
    async def delete_session(self, session_id: str) -> None:
        """Delete session and cascade delete all child records."""
        self._sessions_table.pop(session_id, None)
        self._transcripts_table = [t for t in self._transcripts_table if t["session_id"] != session_id]
        self._triage_table = [t for t in self._triage_table if t["session_id"] != session_id]
        self._events_table = [e for e in self._events_table if e["session_id"] != session_id]
        self._recordings_table = [r for r in self._recordings_table if r["session_id"] != session_id]

        if self._is_live_configured:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.delete(
                        f"{self.supabase_url}/rest/v1/sessions?session_id=eq.{session_id}",
                        headers=self._get_headers(),
                    )
            except Exception as exc:
                logger.warning(f"Live Supabase delete_session failed ({exc})")
