"""Agro Voice AI Agent: bidirectional audio processor & mock voice synthesizer."""

import base64
import math
import numpy as np
from typing import Dict, Any, Optional


class AgroVoiceAgent:
    """Voice AI agent ('agro') handling audio frame processing and mock streaming response."""

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.packet_count = 0
        self.total_bytes = 0

    def process_incoming_audio(self, raw_bytes: bytes) -> Dict[str, Any]:
        """Processes incoming mic audio chunk, calculates audio level, and generates agent audio."""
        self.packet_count += 1
        self.total_bytes += len(raw_bytes)

        # Estimate RMS audio level
        level_db = -60.0
        if len(raw_bytes) >= 2:
            try:
                samples = np.frombuffer(raw_bytes[:len(raw_bytes) - (len(raw_bytes) % 2)], dtype=np.int16)
                if len(samples) > 0:
                    rms = np.sqrt(np.mean(samples.astype(np.float32) ** 2))
                    if rms > 0:
                        level_db = min(0.0, 20.0 * math.log10(rms / 32767.0))
            except Exception:
                pass

        # Generate agent audio response (gentle resonant confirmation tone / mock speech waveform)
        agent_audio = self._generate_agent_response_frame(duration_ms=100)
        agent_audio_b64 = base64.b64encode(agent_audio).decode("ascii")

        return {
            "type": "agent_audio",
            "agent": "agro",
            "packet_id": self.packet_count,
            "caller_level_db": round(level_db, 1),
            "payload": agent_audio_b64,
            "encoding": "pcm_16k_mono",
            "status": "connected",
        }

    def _generate_agent_response_frame(self, duration_ms: int = 100) -> bytes:
        """Generates a soft harmonic tone (16kHz 16-bit PCM) for real client AudioContext playback."""
        num_samples = int(self.sample_rate * (duration_ms / 1000.0))
        t = np.linspace(0, duration_ms / 1000.0, num_samples, endpoint=False)
        # Gentle dual-harmonic tactical presence tone (440Hz + 880Hz subtle)
        freq = 440.0 + (10.0 * math.sin(self.packet_count * 0.2))
        wave = (0.25 * np.sin(2 * np.pi * freq * t) + 0.1 * np.sin(2 * np.pi * (freq * 2) * t))
        samples = (wave * 12000).astype(np.int16)
        return samples.tobytes()
