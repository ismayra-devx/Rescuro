"""Tests for TTSService real audio synthesis and format transcoding."""

import pytest
from app.services.tts_service import (
    TTSService,
    pcm16_to_ulaw,
    ulaw_to_pcm16,
    generate_fallback_ulaw_audio,
)


@pytest.mark.asyncio
async def test_tts_synthesize_real_audio_bytes():
    """Verify that synthesize_and_play generates real audio bytes (not mock string)."""
    tts = TTSService()
    session_id = "test_sess_001"
    text = "Emergency response unit is on the way."

    audio_bytes = await tts.synthesize_and_play(session_id=session_id, text=text, tts_halted=False)

    assert audio_bytes is not None
    assert isinstance(audio_bytes, bytes)
    assert len(audio_bytes) > 0
    # Must NOT be mock string prefix
    assert not audio_bytes.startswith(b"MOCK_AUDIO_PAYLOAD_")
    assert tts.get_last_played(session_id) == text


@pytest.mark.asyncio
async def test_tts_halts_on_supervisor_takeover():
    """Verify that TTS is suppressed when tts_halted is True."""
    tts = TTSService()
    session_id = "test_sess_halt"
    audio_bytes = await tts.synthesize_and_play(
        session_id=session_id,
        text="This should not be spoken.",
        tts_halted=True,
    )
    assert audio_bytes is None


def test_pcm16_to_ulaw_and_back():
    """Verify round-trip ITU-T G.711 u-law compression/decompression."""
    import numpy as np

    # Generate synthetic 8kHz 16-bit PCM wave
    duration = 0.1  # 100ms
    sample_rate = 8000
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    pcm_in = (np.sin(2 * np.pi * 440.0 * t) * 20000).astype(np.int16).tobytes()

    ulaw = pcm16_to_ulaw(pcm_in)
    assert len(ulaw) == len(pcm_in) // 2  # 2 bytes/sample to 1 byte/sample

    pcm_out = ulaw_to_pcm16(ulaw)
    assert len(pcm_out) == len(pcm_in)


def test_generate_fallback_ulaw_audio():
    """Verify fallback audio generator generates non-empty u-law byte stream."""
    audio = generate_fallback_ulaw_audio(duration_sec=0.5, freq=440.0)
    assert isinstance(audio, bytes)
    # At 8kHz 1-byte per sample, 0.5s is 4000 bytes
    assert len(audio) == 4000
