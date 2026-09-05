"""TTS Service module for synthesizing voice responses and controlling audio playback.

Supports real voice audio synthesis using:
1. Deepgram Aura TTS (native 8kHz mulaw)
2. OpenAI Speech API (downsampled & encoded to 8kHz mulaw)
3. ElevenLabs TTS (native ulaw_8000)
4. Offline synthesized ITU-T G.711 mulaw audio generator fallback
"""

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional
import httpx
import numpy as np

try:
    from app.config import settings
except ImportError:
    from config import settings

logger = logging.getLogger("echosphere.tts")


def pcm16_to_ulaw(pcm_data: bytes) -> bytes:
    """Encodes 16-bit linear PCM audio bytes to ITU-T G.711 u-law bytes."""
    if not pcm_data:
        return b""
    samples = np.frombuffer(pcm_data, dtype=np.int16)
    BIAS = 0x84
    CLIP = 32635
    abs_samples = np.abs(samples)
    abs_samples = np.clip(abs_samples, 0, CLIP) + BIAS
    exponent = np.zeros_like(abs_samples, dtype=np.uint8)
    for e in range(7, -1, -1):
        mask = (abs_samples & (1 << (e + 7))) != 0
        exponent = np.where(mask & (exponent == 0), e, exponent)
    mantissa = ((abs_samples >> (exponent + 3)) & 0x0F).astype(np.uint8)
    sign = np.where(samples < 0, 0x80, 0x00).astype(np.uint8)
    ulaw = ~(sign | (exponent << 4) | mantissa) & 0xFF
    return ulaw.astype(np.uint8).tobytes()


def ulaw_to_pcm16(ulaw_data: bytes) -> bytes:
    """Decodes ITU-T G.711 u-law bytes to 16-bit linear PCM audio bytes."""
    if not ulaw_data:
        return b""
    ulaw = np.frombuffer(ulaw_data, dtype=np.uint8)
    inv = (~ulaw).astype(np.int32)
    sign = inv & 0x80
    exponent = (inv >> 4) & 0x07
    mantissa = inv & 0x0F
    sample = ((mantissa << 3) + 0x84) << exponent
    sample = sample - 0x84
    sample = np.where(sign != 0, -sample, sample)
    return sample.astype(np.int16).tobytes()


def generate_fallback_ulaw_audio(duration_sec: float = 0.6, freq: float = 440.0) -> bytes:
    """Generates valid 8kHz ITU-T G.711 u-law audio tones for offline or unconfigured environments."""
    sample_rate = 8000
    total_samples = int(sample_rate * duration_sec)
    t = np.linspace(0, duration_sec, total_samples, endpoint=False)
    # Dual-tone modulated signal with envelope decay to sound natural
    envelope = np.exp(-3.0 * t)
    signal = (0.6 * np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * (freq * 1.5) * t)) * envelope
    pcm_samples = (signal * 16000).astype(np.int16)
    return pcm16_to_ulaw(pcm_samples.tobytes())


class TTSService:
    """Service to synthesize and stream real audio responses to caller."""

    def __init__(
        self,
        openai_api_key: Optional[str] = None,
        deepgram_api_key: Optional[str] = None,
        elevenlabs_api_key: Optional[str] = None,
    ):
        self.openai_api_key = (openai_api_key or settings.OPENAI_API_KEY or "").strip()
        self.deepgram_api_key = (deepgram_api_key or settings.DEEPGRAM_API_KEY or "").strip()
        self.elevenlabs_api_key = (elevenlabs_api_key or os.getenv("ELEVENLABS_API_KEY", "")).strip()
        self._playback_log: List[Dict[str, Any]] = []

    async def _synthesize_deepgram(self, text: str) -> Optional[bytes]:
        """Synthesize using Deepgram Aura TTS (returns raw 8kHz mulaw bytes)."""
        if not self.deepgram_api_key or self.deepgram_api_key.startswith("your_"):
            return None
        url = "https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000"
        headers = {
            "Authorization": f"Token {self.deepgram_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json={"text": text})
            if resp.status_code == 200 and resp.content:
                logger.info(f"Deepgram Aura synthesized {len(resp.content)} mulaw bytes.")
                return resp.content
            else:
                logger.warning(f"Deepgram Aura TTS status {resp.status_code}: {resp.text}")
        return None

    async def _synthesize_openai(self, text: str) -> Optional[bytes]:
        """Synthesize using OpenAI TTS (pcm format downsampled to 8kHz mulaw)."""
        if not self.openai_api_key or self.openai_api_key.startswith("your_"):
            return None
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.openai_api_key)
            response = await client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text,
                response_format="pcm",  # 24kHz 16-bit linear PCM
            )
            raw_pcm = await response.aread()
            if raw_pcm:
                samples_24k = np.frombuffer(raw_pcm, dtype=np.int16)
                # Downsample 24kHz -> 8kHz (factor of 3)
                samples_8k = samples_24k[::3]
                mulaw_bytes = pcm16_to_ulaw(samples_8k.tobytes())
                logger.info(f"OpenAI TTS synthesized and converted {len(mulaw_bytes)} mulaw bytes.")
                return mulaw_bytes
        except Exception as exc:
            logger.warning(f"OpenAI TTS synthesis error: {exc}")
        return None

    async def _synthesize_elevenlabs(self, text: str) -> Optional[bytes]:
        """Synthesize using ElevenLabs TTS (native ulaw_8000)."""
        if not self.elevenlabs_api_key or self.elevenlabs_api_key.startswith("your_"):
            return None
        voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream?output_format=ulaw_8000"
        headers = {
            "xi-api-key": self.elevenlabs_api_key,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json={"text": text})
            if resp.status_code == 200 and resp.content:
                logger.info(f"ElevenLabs synthesized {len(resp.content)} mulaw bytes.")
                return resp.content
        return None

    async def synthesize_audio(self, text: str) -> bytes:
        """Synthesizes text into real 8kHz ITU-T G.711 u-law audio bytes."""
        # Try Deepgram Aura first (low latency streaming audio)
        audio = await self._synthesize_deepgram(text)
        if audio:
            return audio

        # Try OpenAI TTS
        audio = await self._synthesize_openai(text)
        if audio:
            return audio

        # Try ElevenLabs
        audio = await self._synthesize_elevenlabs(text)
        if audio:
            return audio

        # Valid ITU-T G.711 mulaw fallback audio tone
        duration = min(max(0.4, len(text) * 0.05), 3.0)
        return generate_fallback_ulaw_audio(duration_sec=duration)

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

        # Synthesize real 8kHz u-law audio bytes
        real_audio_bytes = await self.synthesize_audio(text)
        return real_audio_bytes

    def get_last_played(self, session_id: str) -> Optional[str]:
        """Helper for test assertions to verify what was spoken."""
        for item in reversed(self._playback_log):
            if item["session_id"] == session_id:
                return item["text"]
        return None
