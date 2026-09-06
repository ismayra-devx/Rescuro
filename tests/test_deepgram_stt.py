"""Tests for DeepgramSTTAdapter.

Phase 1: Simulated/prerecorded audio against a mock WebSocket server.
         No Deepgram API key or network access required.
Phase 2: Live audio integration test (requires DEEPGRAM_API_KEY env var).

Run:
    pytest tests/test_deepgram_stt.py -v
"""

from __future__ import annotations

import asyncio
import json
import struct
import uuid
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.services.deepgram_stt import (
    AdapterState,
    DeepgramSTTAdapter,
    TranscriptResult,
)


# ──────────────────────────────────────────────────────────────────────
# Helpers: generate synthetic Deepgram server messages
# ──────────────────────────────────────────────────────────────────────

def _make_results_message(
    transcript: str,
    confidence: float = 0.95,
    is_final: bool = True,
    speech_final: bool = False,
    start: float = 0.0,
    duration: float = 1.5,
) -> str:
    """Build a JSON string matching Deepgram's Results message schema."""
    return json.dumps({
        "type": "Results",
        "channel_index": [0, 1],
        "duration": duration,
        "start": start,
        "is_final": is_final,
        "speech_final": speech_final,
        "channel": {
            "alternatives": [
                {
                    "transcript": transcript,
                    "confidence": confidence,
                    "words": [
                        {
                            "word": w,
                            "start": start + i * 0.3,
                            "end": start + (i + 1) * 0.3,
                            "confidence": confidence,
                        }
                        for i, w in enumerate(transcript.split())
                    ],
                }
            ]
        },
    })


def _make_metadata_message(request_id: str = "test-req-001") -> str:
    return json.dumps({
        "type": "Metadata",
        "request_id": request_id,
        "model_info": {"name": "nova-3", "version": "2026-01-01"},
    })


def _make_speech_started_message() -> str:
    return json.dumps({"type": "SpeechStarted", "channel_index": [0]})


def _make_utterance_end_message() -> str:
    return json.dumps({"type": "UtteranceEnd"})


def _make_error_message(msg: str = "test error") -> str:
    return json.dumps({"type": "Error", "message": msg})


def _make_close_stream_message() -> str:
    return json.dumps({"type": "CloseStream"})


def _generate_pcm_silence(duration_ms: int = 100, sample_rate: int = 16000) -> bytes:
    """Generate silent 16-bit PCM audio bytes."""
    num_samples = int(sample_rate * duration_ms / 1000)
    return struct.pack(f"<{num_samples}h", *([0] * num_samples))


def _generate_pcm_tone(
    freq_hz: int = 440,
    duration_ms: int = 500,
    sample_rate: int = 16000,
    amplitude: int = 8000,
) -> bytes:
    """Generate a sine-wave tone as 16-bit PCM."""
    import math

    num_samples = int(sample_rate * duration_ms / 1000)
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        sample = int(amplitude * math.sin(2 * math.pi * freq_hz * t))
        samples.append(max(-32768, min(32767, sample)))
    return struct.pack(f"<{num_samples}h", *samples)


# ──────────────────────────────────────────────────────────────────────
# Fake WebSocket for unit testing
# ──────────────────────────────────────────────────────────────────────

class FakeWebSocket:
    """In-process mock of a websockets.ClientConnection for testing."""

    def __init__(self, server_messages: List[str] | None = None):
        self._server_messages = list(server_messages or [])
        self._sent: List[bytes | str] = []
        self._closed = False
        self._index = 0

    async def send(self, data: bytes | str) -> None:
        if self._closed:
            raise Exception("Connection closed")
        self._sent.append(data)

    async def close(self) -> None:
        self._closed = True

    def __aiter__(self):
        return self

    async def __anext__(self) -> str:
        # Small yield so the event loop can schedule other coroutines
        await asyncio.sleep(0.01)
        if self._index < len(self._server_messages):
            msg = self._server_messages[self._index]
            self._index += 1
            return msg
        raise StopAsyncIteration


# ──────────────────────────────────────────────────────────────────────
# Phase 1: Simulated audio tests (no API key needed)
# ──────────────────────────────────────────────────────────────────────

class TestTranscriptResult:
    """Unit tests for the TranscriptResult dataclass."""

    def test_create_result(self):
        r = TranscriptResult(
            transcript="help me please",
            confidence=0.97,
            is_final=True,
            session_id="sess-001",
        )
        assert r.transcript == "help me please"
        assert r.confidence == 0.97
        assert r.is_final is True
        assert r.session_id == "sess-001"
        assert r.speech_final is False
        assert r.words == []

    def test_result_is_immutable(self):
        r = TranscriptResult(
            transcript="test",
            confidence=0.5,
            is_final=False,
            session_id="s1",
        )
        with pytest.raises(AttributeError):
            r.transcript = "changed"  # type: ignore[misc]


class TestAdapterState:
    """Verify adapter lifecycle states."""

    def test_initial_state_is_idle(self):
        adapter = DeepgramSTTAdapter(session_id="test", api_key="fake")
        assert adapter.state == AdapterState.IDLE

    def test_all_states_exist(self):
        assert set(AdapterState) == {
            AdapterState.IDLE,
            AdapterState.CONNECTING,
            AdapterState.CONNECTED,
            AdapterState.RECONNECTING,
            AdapterState.CLOSED,
            AdapterState.ERROR,
        }


class TestDeepgramSTTAdapterUnit:
    """Unit tests using a FakeWebSocket — no network required."""

    @pytest.fixture
    def session_id(self) -> str:
        return str(uuid.uuid4())

    @pytest.fixture
    def adapter(self, session_id: str) -> DeepgramSTTAdapter:
        return DeepgramSTTAdapter(
            session_id=session_id,
            api_key="fake-test-key",
            max_reconnect_attempts=0,  # Disable reconnect in unit tests
        )

    def test_build_ws_url(self, adapter: DeepgramSTTAdapter):
        url = adapter._build_ws_url()
        assert url.startswith("wss://api.deepgram.com/v1/listen?")
        assert "model=nova-3" in url
        assert "encoding=linear16" in url
        assert "sample_rate=16000" in url
        assert "interim_results=true" in url

    def test_callback_registration(self, adapter: DeepgramSTTAdapter):
        async def dummy(r: TranscriptResult) -> None:
            pass

        adapter.on_transcript(dummy)
        assert len(adapter._callbacks) == 1

    def test_metrics_initial(self, adapter: DeepgramSTTAdapter):
        m = adapter.metrics
        assert m["bytes_sent"] == 0
        assert m["transcripts_received"] == 0
        assert m["state"] == "IDLE"

    @pytest.mark.asyncio
    async def test_send_audio_when_not_connected_warns(
        self, adapter: DeepgramSTTAdapter
    ):
        """Audio should be discarded when adapter is not connected."""
        chunk = _generate_pcm_silence(50)
        await adapter.send_audio(chunk)
        # Queue should remain empty since the audio was discarded
        assert adapter._audio_queue.empty()

    @pytest.mark.asyncio
    async def test_handle_transcript_final(
        self, adapter: DeepgramSTTAdapter, session_id: str
    ):
        """Simulate a final transcript message and verify callback is fired."""
        collected: List[TranscriptResult] = []

        async def collector(result: TranscriptResult) -> None:
            collected.append(result)

        adapter.on_transcript(collector)

        msg = json.loads(
            _make_results_message(
                "there is a fire at my house",
                confidence=0.93,
                is_final=True,
                speech_final=True,
            )
        )
        await adapter._handle_transcript(msg)

        assert len(collected) == 1
        r = collected[0]
        assert r.transcript == "there is a fire at my house"
        assert r.confidence == 0.93
        assert r.is_final is True
        assert r.speech_final is True
        assert r.session_id == session_id
        assert len(r.words) == 7  # 7 words

    @pytest.mark.asyncio
    async def test_handle_transcript_interim(
        self, adapter: DeepgramSTTAdapter
    ):
        """Interim results should also fire callbacks."""
        collected: List[TranscriptResult] = []

        async def collector(result: TranscriptResult) -> None:
            collected.append(result)

        adapter.on_transcript(collector)

        msg = json.loads(
            _make_results_message(
                "there is a",
                confidence=0.80,
                is_final=False,
            )
        )
        await adapter._handle_transcript(msg)

        assert len(collected) == 1
        assert collected[0].is_final is False

    @pytest.mark.asyncio
    async def test_handle_transcript_empty_skipped(
        self, adapter: DeepgramSTTAdapter
    ):
        """Empty interim transcripts should be silently skipped."""
        collected: List[TranscriptResult] = []

        async def collector(result: TranscriptResult) -> None:
            collected.append(result)

        adapter.on_transcript(collector)

        msg = json.loads(
            _make_results_message("", confidence=0.0, is_final=False)
        )
        await adapter._handle_transcript(msg)

        assert len(collected) == 0

    @pytest.mark.asyncio
    async def test_multiple_callbacks_all_fire(
        self, adapter: DeepgramSTTAdapter
    ):
        """All registered callbacks should fire for each transcript."""
        results_a: List[TranscriptResult] = []
        results_b: List[TranscriptResult] = []

        async def cb_a(r: TranscriptResult) -> None:
            results_a.append(r)

        async def cb_b(r: TranscriptResult) -> None:
            results_b.append(r)

        adapter.on_transcript(cb_a)
        adapter.on_transcript(cb_b)

        msg = json.loads(
            _make_results_message("accident on highway", is_final=True)
        )
        await adapter._handle_transcript(msg)

        assert len(results_a) == 1
        assert len(results_b) == 1
        assert results_a[0].transcript == results_b[0].transcript

    @pytest.mark.asyncio
    async def test_callback_exception_doesnt_crash(
        self, adapter: DeepgramSTTAdapter
    ):
        """A failing callback should not prevent others from running."""
        results: List[TranscriptResult] = []

        async def bad_cb(r: TranscriptResult) -> None:
            raise ValueError("intentional test failure")

        async def good_cb(r: TranscriptResult) -> None:
            results.append(r)

        adapter.on_transcript(bad_cb)
        adapter.on_transcript(good_cb)

        msg = json.loads(
            _make_results_message("please send help", is_final=True)
        )
        await adapter._handle_transcript(msg)

        # good_cb should still have received the result
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_stop_sets_closed_state(
        self, adapter: DeepgramSTTAdapter
    ):
        """Stopping the adapter should set state to CLOSED."""
        adapter._state = AdapterState.CONNECTED
        adapter._ws = MagicMock()
        adapter._ws.send = AsyncMock()
        adapter._ws.close = AsyncMock()

        await adapter.stop()
        assert adapter.state == AdapterState.CLOSED

    @pytest.mark.asyncio
    async def test_metrics_after_transcripts(
        self, adapter: DeepgramSTTAdapter
    ):
        """Metrics should reflect transcript count after processing."""
        async def noop(r: TranscriptResult) -> None:
            pass

        adapter.on_transcript(noop)

        for i in range(3):
            msg = json.loads(
                _make_results_message(f"word {i}", is_final=True)
            )
            await adapter._handle_transcript(msg)

        assert adapter.metrics["transcripts_received"] == 3


class TestDeepgramSTTAdapterWithFakeWS:
    """Integration tests using FakeWebSocket — full sender/receiver loops."""

    @pytest.mark.asyncio
    async def test_full_pipeline_simulated_audio(self):
        """Simulate the complete pipeline: connect → send audio → receive transcript."""
        session_id = str(uuid.uuid4())
        adapter = DeepgramSTTAdapter(
            session_id=session_id,
            api_key="fake-key",
            max_reconnect_attempts=0,
        )

        collected: List[TranscriptResult] = []

        async def collector(result: TranscriptResult) -> None:
            collected.append(result)

        adapter.on_transcript(collector)

        # Build a fake WS that will emit messages
        server_messages = [
            _make_metadata_message(),
            _make_speech_started_message(),
            _make_results_message(
                "meri building mein aag lagi hai",
                confidence=0.92,
                is_final=False,
            ),
            _make_results_message(
                "meri building mein aag lagi hai please help",
                confidence=0.96,
                is_final=True,
                speech_final=True,
            ),
            _make_utterance_end_message(),
            _make_close_stream_message(),
        ]
        fake_ws = FakeWebSocket(server_messages)

        # Patch the websocket connection
        with patch(
            "app.services.deepgram_stt.websockets.asyncio.client.connect",
            new_callable=AsyncMock,
            return_value=fake_ws,
        ):
            await adapter._connect()

            # Simulate sending prerecorded audio chunks
            pcm_data = _generate_pcm_tone(440, 500)
            chunk_size = 3200  # 100ms at 16kHz 16-bit
            for i in range(0, len(pcm_data), chunk_size):
                await adapter.send_audio(pcm_data[i : i + chunk_size])

            # Wait for receiver to process all messages
            await asyncio.sleep(0.2)

        await adapter.stop()

        # Verify results
        assert len(collected) == 2  # 1 interim + 1 final
        assert collected[0].is_final is False
        assert collected[1].is_final is True
        assert collected[1].speech_final is True
        assert "aag lagi hai" in collected[1].transcript
        assert collected[1].confidence == 0.96
        assert collected[1].session_id == session_id

        # Verify metrics
        m = adapter.metrics
        assert m["transcripts_received"] == 2
        assert m["state"] == "CLOSED"

    @pytest.mark.asyncio
    async def test_error_message_logged_not_crashed(self):
        """Deepgram error messages should be logged, not crash the adapter."""
        adapter = DeepgramSTTAdapter(
            session_id="err-test",
            api_key="fake",
            max_reconnect_attempts=0,
        )

        server_messages = [
            _make_error_message("Model not available"),
            _make_close_stream_message(),
        ]
        fake_ws = FakeWebSocket(server_messages)

        with patch(
            "app.services.deepgram_stt.websockets.asyncio.client.connect",
            new_callable=AsyncMock,
            return_value=fake_ws,
        ):
            await adapter._connect()
            await asyncio.sleep(0.15)

        await adapter.stop()
        # No crash = success

    @pytest.mark.asyncio
    async def test_multiple_sessions_independent(self):
        """Two adapters with different session_ids should be fully independent."""
        results_a: List[TranscriptResult] = []
        results_b: List[TranscriptResult] = []

        adapter_a = DeepgramSTTAdapter(
            session_id="session-A", api_key="fake", max_reconnect_attempts=0
        )
        adapter_b = DeepgramSTTAdapter(
            session_id="session-B", api_key="fake", max_reconnect_attempts=0
        )

        adapter_a.on_transcript(lambda r: _append(results_a, r))
        adapter_b.on_transcript(lambda r: _append(results_b, r))

        ws_a = FakeWebSocket([
            _make_results_message("help from session A", is_final=True),
            _make_close_stream_message(),
        ])
        ws_b = FakeWebSocket([
            _make_results_message("fire in session B", is_final=True),
            _make_close_stream_message(),
        ])

        call_count = 0

        async def mock_connect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return ws_a if call_count == 1 else ws_b

        with patch(
            "app.services.deepgram_stt.websockets.asyncio.client.connect",
            side_effect=mock_connect,
        ):
            await adapter_a._connect()
            await adapter_b._connect()
            await asyncio.sleep(0.2)

        await adapter_a.stop()
        await adapter_b.stop()

        assert len(results_a) == 1
        assert len(results_b) == 1
        assert results_a[0].session_id == "session-A"
        assert results_b[0].session_id == "session-B"
        assert "session A" in results_a[0].transcript
        assert "session B" in results_b[0].transcript

    @pytest.mark.asyncio
    async def test_prerecorded_emergency_hinglish(self):
        """Simulate a Hinglish emergency transcript from prerecorded audio."""
        session_id = "hinglish-emergency"
        adapter = DeepgramSTTAdapter(
            session_id=session_id,
            api_key="fake",
            language="hi",
            max_reconnect_attempts=0,
        )

        collected: List[TranscriptResult] = []
        adapter.on_transcript(lambda r: _append(collected, r))

        ws = FakeWebSocket([
            _make_metadata_message(),
            _make_results_message(
                "bachao bachao meri gadi ka accident ho gaya",
                confidence=0.88,
                is_final=True,
                speech_final=True,
            ),
            _make_close_stream_message(),
        ])

        with patch(
            "app.services.deepgram_stt.websockets.asyncio.client.connect",
            new_callable=AsyncMock,
            return_value=ws,
        ):
            await adapter._connect()
            # Send simulated audio
            await adapter.send_audio(_generate_pcm_tone(300, 1000))
            await asyncio.sleep(0.15)

        await adapter.stop()

        assert len(collected) == 1
        r = collected[0]
        assert "bachao" in r.transcript
        assert r.confidence == 0.88
        assert r.is_final is True
        assert r.session_id == session_id


# Helper to work around lambda async issues
async def _append(lst: list, item: Any) -> None:
    lst.append(item)


# ──────────────────────────────────────────────────────────────────────
# Phase 2: Integration test with ORCHESTRATOR (still mocked Deepgram)
# ──────────────────────────────────────────────────────────────────────

class TestSTTOrchestratorIntegration:
    """Verify that the STT adapter can feed transcripts into the orchestrator
    pipeline via process_transcript() WITHOUT modifying the orchestrator."""

    @pytest.mark.asyncio
    async def test_stt_feeds_orchestrator(self):
        """Adapter → callback → orchestrator.process_transcript() chain."""
        from app.orchestrator import BattleBuddyOrchestrator

        orchestrator = BattleBuddyOrchestrator()
        session = await orchestrator.create_session()

        session_id = session.session_id
        adapter = DeepgramSTTAdapter(
            session_id=session_id,
            api_key="fake",
            max_reconnect_attempts=0,
        )

        pipeline_results: List[Dict[str, Any]] = []

        async def on_final_transcript(result: TranscriptResult) -> None:
            """Only forward final transcripts to the pipeline."""
            if result.is_final and result.transcript:
                out = await orchestrator.process_transcript(
                    session_id=result.session_id,
                    transcript=result.transcript,
                    stt_confidence=result.confidence,
                )
                pipeline_results.append(out)

        adapter.on_transcript(on_final_transcript)

        ws = FakeWebSocket([
            _make_metadata_message(),
            _make_results_message(
                "hello I need help with my electricity bill",
                confidence=0.95,
                is_final=True,
                speech_final=True,
            ),
            _make_close_stream_message(),
        ])

        with patch(
            "app.services.deepgram_stt.websockets.asyncio.client.connect",
            new_callable=AsyncMock,
            return_value=ws,
        ):
            await adapter._connect()
            await adapter.send_audio(_generate_pcm_silence(200))
            await asyncio.sleep(0.2)

        await adapter.stop()

        # The transcript should have been routed through the full pipeline
        assert len(pipeline_results) == 1
        result = pipeline_results[0]
        assert result["session_id"] == session_id
        assert result["transcript"] == "hello I need help with my electricity bill"
        assert "llm_result" in result
        assert "triage_result" in result
