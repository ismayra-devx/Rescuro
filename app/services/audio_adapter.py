"""Audio stream adapter interface with prerecorded test stream support."""

import asyncio
import logging
from typing import AsyncGenerator, Dict, Optional

logger = logging.getLogger(__name__)


class AudioAdapter:
    """Clean audio streaming interface decoupling media transport from the intelligence pipeline."""

    def __init__(self):
        self._active_sessions: Dict[str, bool] = {}

    async def start_session(self, session_id: str) -> None:
        """Start audio session."""
        self._active_sessions[session_id] = True
        logger.info(f"Audio stream session started for {session_id}")

    async def receive_audio(self, session_id: str, chunk: bytes) -> None:
        """Ingest incoming audio bytes chunk."""
        if not self._active_sessions.get(session_id, False):
            raise RuntimeError(f"Audio session {session_id} is not active.")
        # Pass to STT processor or buffer

    async def send_audio(self, session_id: str, chunk: bytes) -> None:
        """Stream outbound synthesized audio bytes to caller."""
        if not self._active_sessions.get(session_id, False):
            raise RuntimeError(f"Audio session {session_id} is not active.")
        logger.debug(f"Streaming {len(chunk)} audio bytes to {session_id}")

    async def stop_session(self, session_id: str) -> None:
        """Terminate audio session."""
        self._active_sessions.pop(session_id, None)
        logger.info(f"Audio stream session stopped for {session_id}")

    async def stream_prerecorded_test_stream(
        self,
        session_id: str,
        simulated_transcript: str,
        chunk_count: int = 3,
    ) -> AsyncGenerator[bytes, None]:
        """Prerecorded/mock test stream ensuring pipeline remains testable even if live Agora/Twilio stream is unstable."""
        await self.start_session(session_id)
        for i in range(chunk_count):
            await asyncio.sleep(0.01)
            chunk = f"TEST_AUDIO_CHUNK_{i}_{simulated_transcript[:10]}".encode("utf-8")
            await self.receive_audio(session_id, chunk)
            yield chunk
