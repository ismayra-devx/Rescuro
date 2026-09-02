"""Battle Buddy Pipeline Orchestrator."""

import logging
from typing import Any, Callable, Dict, List, Optional
import uuid

from app.models.events import BattleBuddyEvent, EventType
from app.models.session import CallSession, SessionStatus
from app.services.audio_adapter import BaseAudioAdapter, get_audio_adapter
from app.services.openai_service import OpenAIService
from app.services.supabase_service import SupabaseService
from app.services.triage_service import deterministic_triage
from app.services.tts_service import TTSService

logger = logging.getLogger(__name__)


class BattleBuddyOrchestrator:
    """FastAPI Orchestration engine governing session lifecycle, triage, and routing."""

    def __init__(
        self,
        openai_service: Optional[OpenAIService] = None,
        supabase_service: Optional[SupabaseService] = None,
        tts_service: Optional[TTSService] = None,
        audio_adapter: Optional[BaseAudioAdapter] = None,
    ):
        self.openai_service = openai_service or OpenAIService()
        self.supabase_service = supabase_service or SupabaseService()
        self.tts_service = tts_service or TTSService()
        
        # Clean audio transport adapter decoupled from Agora SDK details
        if audio_adapter is not None:
            self.audio_adapter = audio_adapter
        else:
            self.audio_adapter = get_audio_adapter()

        self._sessions: Dict[str, CallSession] = {}
        self._event_subscribers: List[Callable[[BattleBuddyEvent], Any]] = []

    def subscribe(self, callback: Callable[[BattleBuddyEvent], Any]) -> None:
        """Register subscriber for event broadcasts (e.g. WebSocket, dashboard)."""
        self._event_subscribers.append(callback)

    async def emit_event(
        self,
        session_id: str,
        event_type: EventType,
        payload: Dict[str, Any],
    ) -> BattleBuddyEvent:
        """Create, broadcast, and persist an event adhering to the Critical Event Contract.
        
        Order: Event generation -> Event broadcast -> Supabase persistence.
        """
        event = BattleBuddyEvent(
            event_id=str(uuid.uuid4()),
            session_id=session_id,
            event_type=event_type,
            payload=payload,
        )

        # 1. Event Broadcast to subscribers (WebSockets, monitors)
        for subscriber in self._event_subscribers:
            try:
                res = subscriber(event)
                if hasattr(res, "__await__"):
                    await res
            except Exception as exc:
                logger.error(f"Event subscriber error: {exc}")

        # 2. Supabase Persistence
        await self.supabase_service.persist_event(event)

        return event

    def create_session_instant(
        self,
        call_sid: Optional[str] = None,
        from_number: Optional[str] = None,
        to_number: Optional[str] = None,
    ) -> CallSession:
        """Instantly create and register session in memory with zero I/O blocking."""
        session_id = str(uuid.uuid4())
        session = CallSession(
            session_id=session_id,
            call_sid=call_sid,
            status=SessionStatus.ACTIVE,
            from_number=from_number,
            to_number=to_number,
        )
        self._sessions[session_id] = session
        return session

    async def persist_session_start(self, session: CallSession) -> None:
        """Asynchronously persist session creation and emit CALL_STARTED event."""
        await self.supabase_service.persist_session(
            session.session_id,
            {
                "call_sid": session.call_sid,
                "from_number": session.from_number,
                "to_number": session.to_number,
                "status": session.status.value,
            },
        )

        await self.emit_event(
            session_id=session.session_id,
            event_type=EventType.CALL_STARTED,
            payload={
                "call_sid": session.call_sid,
                "from_number": session.from_number,
                "to_number": session.to_number,
            },
        )

    async def create_session(
        self,
        call_sid: Optional[str] = None,
        from_number: Optional[str] = None,
        to_number: Optional[str] = None,
    ) -> CallSession:
        """Initialize and persist a new call session."""
        session = self.create_session_instant(
            call_sid=call_sid,
            from_number=from_number,
            to_number=to_number,
        )
        await self.persist_session_start(session)
        return session

    def get_session(self, session_id: str) -> Optional[CallSession]:
        """Retrieve in-memory session object."""
        return self._sessions.get(session_id)

    async def process_transcript(
        self,
        session_id: str,
        transcript: str,
        stt_confidence: float = 0.9,
    ) -> Dict[str, Any]:
        """Executes the pipeline in exact order:
        session -> transcript -> LLM -> triage -> automated TTS OR supervisor handoff -> event broadcast -> persist.
        """
        session = self.get_session(session_id)
        if not session:
            session = await self.create_session()
            session_id = session.session_id

        session.latest_transcript = transcript

        # 1. Emit TRANSCRIPT_RECEIVED & persist
        await self.emit_event(
            session_id=session_id,
            event_type=EventType.TRANSCRIPT_RECEIVED,
            payload={"transcript": transcript, "stt_confidence": stt_confidence},
        )
        await self.supabase_service.persist_transcript(
            session_id=session_id,
            transcript=transcript,
            stt_confidence=stt_confidence,
            is_final=True,
        )

        # 2. Call LLM Service (Structured Output)
        llm_result = await self.openai_service.extract_intent(transcript)
        await self.emit_event(
            session_id=session_id,
            event_type=EventType.INTENT_EXTRACTED,
            payload=llm_result.model_dump(),
        )

        # 3. Deterministic Triage
        triage_result = deterministic_triage(
            stt_confidence=stt_confidence,
            llm_confidence=llm_result.llm_confidence,
            emergency=llm_result.emergency,
            transcript=transcript,
        )
        session.latest_triage = triage_result.model_dump()

        await self.emit_event(
            session_id=session_id,
            event_type=EventType.TRIAGE_COMPLETED,
            payload=triage_result.model_dump(),
        )
        await self.supabase_service.persist_triage(
            session_id=session_id,
            triage_data=triage_result.model_dump(),
        )

        # 4. Route Decision: automated TTS OR supervisor handoff
        audio_output = None
        if triage_result.route == "automated":
            if not session.tts_halted and session.status != SessionStatus.SUPERVISOR_CONNECTED:
                audio_output = await self.tts_service.synthesize_and_play(
                    session_id=session_id,
                    text=llm_result.reply,
                    tts_halted=session.tts_halted,
                )
                await self.emit_event(
                    session_id=session_id,
                    event_type=EventType.TTS_READY,
                    payload={
                        "reply": llm_result.reply,
                        "audio_synthesized": audio_output is not None,
                    },
                )
            else:
                logger.info(f"Session {session_id}: Automated TTS suppressed because supervisor has taken over.")
        else:
            # Route is human_supervisor
            await self.emit_event(
                session_id=session_id,
                event_type=EventType.EMERGENCY_DETECTED,
                payload={
                    "priority": triage_result.priority,
                    "reason": triage_result.reason,
                    "incident_type": llm_result.incident_type,
                    "urgency": llm_result.urgency,
                    "matched_keywords": triage_result.matched_keywords,
                },
            )

        return {
            "session_id": session_id,
            "transcript": transcript,
            "llm_result": llm_result.model_dump(),
            "triage_result": triage_result.model_dump(),
            "status": session.status.value,
            "tts_halted": session.tts_halted,
        }

    async def supervisor_override(
        self,
        session_id: str,
        reason: Optional[str] = "Manual supervisor takeover",
    ) -> CallSession:
        """Handle supervisor takeover: update session state, halt automated TTS, check media bridge, broadcast event."""
        session = self.get_session(session_id)
        if not session:
            raise KeyError(f"Session '{session_id}' not found.")

        # Real media bridge state from audio adapter (Agora or mock) - never fake connection
        media_bridge = await self.audio_adapter.bridge_supervisor(session_id)
        session.media_bridge = media_bridge

        session.status = SessionStatus.SUPERVISOR_CONNECTED
        session.tts_halted = True
        session.supervisor_takeover_reason = reason

        await self.supabase_service.persist_session(
            session_id,
            {
                "status": session.status.value,
                "tts_halted": True,
                "supervisor_takeover_reason": reason,
                "media_bridge": media_bridge,
            },
        )

        await self.emit_event(
            session_id=session_id,
            event_type=EventType.SUPERVISOR_CONNECTED,
            payload={
                "reason": reason,
                "status": session.status.value,
                "tts_halted": True,
                "media_bridge_connected": media_bridge.get("connected", False),
                "media_bridge": media_bridge,
            },
        )

        return session

    async def end_call(self, session_id: str) -> Optional[CallSession]:
        """Mark call session as completed and emit CALL_ENDED."""
        session = self.get_session(session_id)
        if not session:
            return None

        session.status = SessionStatus.COMPLETED
        await self.supabase_service.persist_session(
            session_id,
            {"status": session.status.value},
        )

        await self.emit_event(
            session_id=session_id,
            event_type=EventType.CALL_ENDED,
            payload={"session_id": session_id, "status": session.status.value},
        )

        return session
