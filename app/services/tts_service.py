"""TTS Service module for synthesizing voice responses and controlling audio playback."""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class TTSService:
    """Service to synthesize and stream audio responses to caller."""

    def __init__(self):
        self._playback_log = []

    async def synthesize_and_play(
        self,
        session_id: str,
        text: str,
        tts_halted: bool = False,
    ) -> Optional[bytes]:
        """Synthesize text into audio bytes if TTS has not been halted by supervisor takeover."""
        if tts_halted:
            logger.info(f"TTS skipped for session {session_id}: supervisor takeover is active.")
            return None

        logger.info(f"[TTS Synthesis] Session {session_id}: '{text}'")
        self._playback_log.append({"session_id": session_id, "text": text})

        # Return mock audio payload (e.g. simulated 8kHz u-law or WAV bytes)
        mock_audio_bytes = b"MOCK_AUDIO_PAYLOAD_" + text.encode("utf-8")[:32]
        return mock_audio_bytes

    def get_last_played(self, session_id: str) -> Optional[str]:
        """Helper for test assertions to verify what was spoken."""
        for item in reversed(self._playback_log):
            if item["session_id"] == session_id:
                return item["text"]
        return None
