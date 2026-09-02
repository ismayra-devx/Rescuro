"""Audio streaming adapter interface and implementations.

Provides a clean abstraction decoupling Battle Buddy pipeline and FastAPI
orchestration from Agora SDK or other audio transport details.
Includes BaseAudioAdapter, MockAudioAdapter, RecordedAudioAdapter,
and factory get_audio_adapter with automatic fallback support.
"""

import abc
import asyncio
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

logger = logging.getLogger(__name__)


class BaseAudioAdapter(abc.ABC):
    """Clean audio streaming interface decoupling media transport from the intelligence pipeline."""

    @abc.abstractmethod
    async def start_session(self, session_id: str, **kwargs: Any) -> None:
        """Start or join an audio streaming session."""
        pass

    @abc.abstractmethod
    async def receive_audio(self, session_id: str, chunk: bytes) -> None:
        """Ingest incoming audio bytes chunk."""
        pass

    @abc.abstractmethod
    async def send_audio(self, session_id: str, chunk: bytes) -> None:
        """Stream outbound synthesized audio bytes to caller."""
        pass

    @abc.abstractmethod
    async def stop_session(self, session_id: str) -> None:
        """Terminate and clean up audio streaming session."""
        pass

    @abc.abstractmethod
    def is_active(self, session_id: str) -> bool:
        """Check if audio streaming session is currently active."""
        pass


class MockAudioAdapter(BaseAudioAdapter):
    """Clearly named mock adapter simulating audio streaming for testing.
    
    Permits end-to-end testing of Battle Buddy pipelines, triage routing,
    and lifecycle events without requiring Agora SDK or external audio infrastructure.
    """

    def __init__(self):
        self._active_sessions: Dict[str, bool] = {}
        self._sent_chunks: Dict[str, List[bytes]] = {}
        self._received_chunks: Dict[str, List[bytes]] = {}

    async def start_session(self, session_id: str, **kwargs: Any) -> None:
        """Start audio session."""
        self._active_sessions[session_id] = True
        self._sent_chunks[session_id] = []
        self._received_chunks[session_id] = []
        logger.info(f"Mock audio stream session started for {session_id}")

    async def receive_audio(self, session_id: str, chunk: bytes) -> None:
        """Ingest incoming audio bytes chunk."""
        if not self.is_active(session_id):
            raise RuntimeError(f"Audio session '{session_id}' is not active.")
        self._received_chunks.setdefault(session_id, []).append(chunk)
        logger.debug(f"Mock received {len(chunk)} audio bytes for {session_id}")

    async def send_audio(self, session_id: str, chunk: bytes) -> None:
        """Stream outbound synthesized audio bytes to caller."""
        if not self.is_active(session_id):
            raise RuntimeError(f"Audio session '{session_id}' is not active.")
        self._sent_chunks.setdefault(session_id, []).append(chunk)
        logger.debug(f"Mock streamed {len(chunk)} audio bytes to {session_id}")

    async def stop_session(self, session_id: str) -> None:
        """Terminate audio session."""
        self._active_sessions.pop(session_id, None)
        logger.info(f"Mock audio stream session stopped for {session_id}")

    def is_active(self, session_id: str) -> bool:
        """Check if session is currently active."""
        return self._active_sessions.get(session_id, False)

    def get_sent_chunks(self, session_id: str) -> List[bytes]:
        """Inspect sent audio chunks for verification."""
        return self._sent_chunks.get(session_id, [])

    def get_received_chunks(self, session_id: str) -> List[bytes]:
        """Inspect received audio chunks for verification."""
        return self._received_chunks.get(session_id, [])

    def clear(self, session_id: Optional[str] = None) -> None:
        """Clear recorded chunks for a specific session or all sessions."""
        if session_id:
            self._sent_chunks.pop(session_id, None)
            self._received_chunks.pop(session_id, None)
            self._active_sessions.pop(session_id, None)
        else:
            self._sent_chunks.clear()
            self._received_chunks.clear()
            self._active_sessions.clear()

    async def stream_prerecorded_test_stream(
        self,
        session_id: str,
        simulated_transcript: str,
        chunk_count: int = 3,
    ) -> AsyncGenerator[bytes, None]:
        """Prerecorded test stream ensuring pipeline remains testable even if live Agora/Twilio stream is unstable."""
        await self.start_session(session_id)
        for i in range(chunk_count):
            await asyncio.sleep(0.01)
            chunk = f"TEST_AUDIO_CHUNK_{i}_{simulated_transcript[:10]}".encode("utf-8")
            await self.receive_audio(session_id, chunk)
            yield chunk


class RecordedAudioAdapter(MockAudioAdapter):
    """Audio adapter that records sent/received streams and can replay recorded audio for verification."""
    pass


# Backward compatibility alias
AudioAdapter = MockAudioAdapter


def get_audio_adapter(
    adapter_type: Optional[str] = None,
    fallback_to_mock: bool = True,
    **kwargs: Any,
) -> BaseAudioAdapter:
    """Factory creating an audio adapter with automatic graceful fallback.
    
    If Agora credentials or SDK integration fails, it smoothly falls back
    to MockAudioAdapter so end-to-end event flows remain fully operational.
    """
    from app.config import settings

    target = (adapter_type or "").lower().strip()

    # Determine if Agora should be attempted
    should_try_agora = (target == "agora") or (
        not target
        and bool(settings.AGORA_APP_ID)
        and settings.AGORA_APP_ID.strip() != "your_agora_app_id"
    )

    if should_try_agora:
        try:
            from app.services.agora_service import AgoraAudioAdapter
            return AgoraAudioAdapter(**kwargs)
        except Exception as exc:
            if fallback_to_mock:
                logger.warning(
                    f"AgoraAudioAdapter initialization failed ({exc}). "
                    "Falling back to MockAudioAdapter so end-to-end event flow can proceed."
                )
                return MockAudioAdapter()
            raise

    if target in ("recorded", "prerecorded"):
        return RecordedAudioAdapter()

    return MockAudioAdapter()
