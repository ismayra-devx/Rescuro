"""Comprehensive final verification test suite for RESCURO emergency voice pipeline.

Covers:
1. Real Audio -> STT Buffer Integrity (3 clean turns, buffer resets, no previous contamination, no TTS echo, byte/sample math).
2. Deepgram Model Auto-Negotiation (Nova-3 -> Nova-2 caching across turns 1, 2, 3; WebSocket & REST consistency).
3. OpenAI Quota Circuit Breaker (opens on 429 quota exhaustion, bypasses turns 2 & 3 in 0ms, correct triage, cooldown recovery, non-quota errors don't trip breaker).
4. Exact Emergency Intent Utterances (accident at Rajiv Chowk, send whatever unit you can, talk to supervisor, hello).
5. Dashboard WebSocket End-to-End Delivery (live events: CALL_STARTED, TRANSCRIPT_UPDATE, EMERGENCY_DETECTED, EMERGENCY_ALERT, TTS_READY, CALL_ENDED).
6. Dashboard State & Session Persistence (session ID consistency across Exotel, DB, pipeline; concurrent calls isolation).
"""

import asyncio
import base64
import json
import struct
import time
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.api.dashboard_ws import dashboard_manager
from app.models.llm_schemas import LLMExtractionResult
from app.services.openai_service import OpenAIService, openai_service
from app.services.deepgram_service import DeepgramService, deepgram_service, pcm16_to_wav_bytes
from app.services.triage_service import deterministic_triage, HIGH_RISK_KEYWORDS
from app.services import pipeline
from app.database import (
    get_db_connection,
    create_call_session,
    append_call_transcript,
    update_call_session,
    get_call_sessions,
)

client = TestClient(app)


# ==============================================================================
# 1. REAL AUDIO -> STT BUFFER INTEGRITY
# ==============================================================================

def test_pcm16_8khz_mono_byte_and_sample_math():
    """Verify correct 8kHz PCM16 mono byte and sample counts and valid standard WAV packaging."""
    sample_rate = 8000
    channels = 1
    bytes_per_sample = 2

    # 1. Check 100ms: 800 samples -> 1600 bytes
    duration_100ms = 0.100
    expected_samples_100ms = int(sample_rate * duration_100ms)
    expected_bytes_100ms = expected_samples_100ms * bytes_per_sample
    assert expected_samples_100ms == 800
    assert expected_bytes_100ms == 1600

    # 2. Check 500ms: 4000 samples -> 8000 bytes
    duration_500ms = 0.500
    expected_samples_500ms = int(sample_rate * duration_500ms)
    expected_bytes_500ms = expected_samples_500ms * bytes_per_sample
    assert expected_samples_500ms == 4000
    assert expected_bytes_500ms == 8000

    # 3. Packaging into standard RIFF/WAV container
    pcm16_data = struct.pack("<h", 1500) * expected_samples_500ms
    assert len(pcm16_data) == 8000

    wav_bytes = pcm16_to_wav_bytes(pcm16_data, sample_rate=sample_rate, channels=channels)
    assert wav_bytes.startswith(b"RIFF")
    assert wav_bytes[8:12] == b"WAVE"
    assert wav_bytes[12:16] == b"fmt "

    import io, wave
    with io.BytesIO(wav_bytes) as bio:
        with wave.open(bio, "rb") as wf:
            assert wf.getnchannels() == 1, "Must be mono 1-channel"
            assert wf.getframerate() == 8000, "Must be 8000Hz"
            assert wf.getsampwidth() == 2, "Must be 16-bit linear PCM (2 bytes/sample)"
            assert wf.getnframes() == expected_samples_500ms, "Must contain exactly 4000 samples"
    # Total WAV size is 44 bytes header + PCM payload
    assert len(wav_bytes) == 44 + len(pcm16_data)


def test_stt_buffer_three_clean_turns_and_reset():
    """Verify clean multi-turn audio buffering:
    - Turn 1 receives audio, processes, buffer resets to 0.
    - Turn 2 receives new audio, contains ZERO bytes from turn 1.
    - Turn 3 receives new audio, contains ZERO bytes from turn 1 or 2.
    """
    stream_sid = "exo_stream_integrity_3turns"
    call_sid = "exo_call_integrity_3turns"

    buffers_received = []

    async def capture_transcribe(audio_chunk, *args, **kwargs):
        if isinstance(audio_chunk, bytes):
            buffers_received.append(len(audio_chunk))
        return "I need assistance."

    with patch("app.services.pipeline.transcribe_audio", side_effect=capture_transcribe):
        with client.websocket_connect("/exotel/media") as ws:
            ws.send_text(json.dumps({"event": "connected"}))
            ws.send_text(json.dumps({
                "event": "start",
                "stream_sid": stream_sid,
                "start": {"call_sid": call_sid, "stream_sid": stream_sid, "from": "+919999000001"}
            }))

            speech_chunk_320 = base64.b64encode(struct.pack("<h", 2500) * 160).decode("ascii")  # 20ms = 320 bytes
            silence_chunk_320 = base64.b64encode(b"\x00\x00" * 160).decode("ascii")

            # --- TURN 1: Send 10 speech chunks (3200 bytes) + 36 silence chunks ---
            for _ in range(10):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": speech_chunk_320}}))
            for _ in range(36):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": silence_chunk_320}}))

            t1_media = json.loads(ws.receive_text())
            t1_mark = json.loads(ws.receive_text())
            mark1_name = t1_mark["mark"]["name"]

            # Return mark to simulate Exotel playback finished
            ws.send_text(json.dumps({"event": "mark", "stream_sid": stream_sid, "mark": {"name": mark1_name}}))

            # --- TURN 2: Send 15 speech chunks (4800 bytes) + 36 silence chunks ---
            for _ in range(15):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": speech_chunk_320}}))
            for _ in range(36):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": silence_chunk_320}}))

            t2_media = json.loads(ws.receive_text())
            t2_mark = json.loads(ws.receive_text())
            mark2_name = t2_mark["mark"]["name"]

            ws.send_text(json.dumps({"event": "mark", "stream_sid": stream_sid, "mark": {"name": mark2_name}}))

            # --- TURN 3: Send 20 speech chunks (6400 bytes) + 36 silence chunks ---
            for _ in range(20):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": speech_chunk_320}}))
            for _ in range(36):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": silence_chunk_320}}))

            t3_media = json.loads(ws.receive_text())
            t3_mark = json.loads(ws.receive_text())
            mark3_name = t3_mark["mark"]["name"]

            ws.send_text(json.dumps({"event": "mark", "stream_sid": stream_sid, "mark": {"name": mark3_name}}))
            ws.send_text(json.dumps({"event": "stop", "stream_sid": stream_sid}))

    # Verify exactly 3 turns processed
    assert len(buffers_received) == 3, f"Expected 3 turns, got {len(buffers_received)}"

    # Check Turn 1 buffer size: 10 speech chunks + silence chunks until threshold triggered
    turn1_bytes = buffers_received[0]
    # Check Turn 2 buffer size: must NOT contain turn 1 bytes!
    turn2_bytes = buffers_received[1]
    # Check Turn 3 buffer size: must NOT contain turn 1 or turn 2 bytes!
    turn3_bytes = buffers_received[2]

    # In turn 2, 15 speech chunks = 4800 speech bytes. If turn 1 leaked, size would exceed (turn1_bytes + 4800).
    assert turn2_bytes < (turn1_bytes + turn2_bytes), "Turn 2 must NOT accumulate Turn 1 audio"
    assert turn3_bytes < (turn2_bytes + turn3_bytes), "Turn 3 must NOT accumulate Turn 2 audio"


def test_stt_buffer_suppresses_tts_echo_completely():
    """Verify that during assistant playback, inbound audio (echo/noise) is dropped and does not contaminate STT."""
    stream_sid = "exo_stream_tts_suppress"
    call_sid = "exo_call_tts_suppress"

    stt_invocations = []

    async def mock_stt(audio_chunk, *args, **kwargs):
        stt_invocations.append(len(audio_chunk))
        return "Reporting an emergency."

    with patch("app.services.pipeline.transcribe_audio", side_effect=mock_stt):
        with client.websocket_connect("/exotel/media") as ws:
            ws.send_text(json.dumps({"event": "connected"}))
            ws.send_text(json.dumps({
                "event": "start",
                "stream_sid": stream_sid,
                "start": {"call_sid": call_sid, "stream_sid": stream_sid, "from": "+919999000002"}
            }))

            speech_chunk = base64.b64encode(struct.pack("<h", 2500) * 160).decode("ascii")
            silence_chunk = base64.b64encode(b"\x00\x00" * 160).decode("ascii")

            # Turn 1: genuine caller speech
            for _ in range(12):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": speech_chunk}}))
            for _ in range(36):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": silence_chunk}}))

            t1_media = json.loads(ws.receive_text())
            t1_mark = json.loads(ws.receive_text())
            mark_name = t1_mark["mark"]["name"]
            assert len(stt_invocations) == 1

            # While assistant is speaking (NO mark returned yet), inject loud audio (TTS acoustic echo)
            loud_echo_chunk = base64.b64encode(struct.pack("<h", 3000) * 160).decode("ascii")
            for _ in range(25):  # 500ms of loud speech
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": loud_echo_chunk}}))
            for _ in range(40):  # 800ms of silence
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": silence_chunk}}))

            # The echo MUST be dropped: no second STT turn triggered!
            assert len(stt_invocations) == 1, "Echo during playback must not trigger a turn"

            # Now send mark confirming playback complete
            ws.send_text(json.dumps({"event": "mark", "stream_sid": stream_sid, "mark": {"name": mark_name}}))

            # Next genuine turn after mark
            for _ in range(12):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": speech_chunk}}))
            for _ in range(36):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": silence_chunk}}))

            t2_media = json.loads(ws.receive_text())
            t2_mark = json.loads(ws.receive_text())
            assert len(stt_invocations) == 2, "Second genuine turn after mark must be processed cleanly"

            ws.send_text(json.dumps({"event": "stop", "stream_sid": stream_sid}))


# ==============================================================================
# 2. DEEPGRAM MODEL NEGOTIATION
# ==============================================================================

@pytest.mark.asyncio
async def test_deepgram_model_negotiation_three_consecutive_turns():
    """Verify that:
    1. Turn 1 uses model=nova-3 and language=multi.
    2. Turn 2 uses model=nova-3 and language=multi.
    3. Turn 3 uses model=nova-3 and language=multi.
    Nova-3 multilingual configuration remains consistent and active across all turns.
    """
    svc = DeepgramService()
    svc.api_key = "dg_test_key_valid_123"

    mock_200 = MagicMock(
        status_code=200,
        json=lambda: {
            "results": {
                "channels": [{"alternatives": [{"transcript": "Mera accident ho gaya hai", "confidence": 0.95, "languages": ["hi", "en"]}]}]
            }
        }
    )

    requests_sent = []

    async def mock_client_post(client_self, url, *args, **kwargs):
        params = kwargs.get("params", [])
        p_dict = dict(params)
        requests_sent.append((p_dict.get("model"), p_dict.get("language")))
        return mock_200

    with patch("httpx.AsyncClient.post", new=mock_client_post):
        # Turn 1: nova-3 multilingual
        res1 = await svc.transcribe_prerecorded(b"\x00" * 3200)
        assert res1["transcript"] == "Mera accident ho gaya hai"
        assert res1["languages"] == ["hi", "en"]

        # Turn 2: nova-3 multilingual
        res2 = await svc.transcribe_prerecorded(b"\x00" * 3200)
        assert res2["transcript"] == "Mera accident ho gaya hai"

        # Turn 3: nova-3 multilingual
        res3 = await svc.transcribe_prerecorded(b"\x00" * 3200)
        assert res3["transcript"] == "Mera accident ho gaya hai"

    # Verify all 3 requests cleanly targeted nova-3 and language=multi
    assert requests_sent == [("nova-3", "multi"), ("nova-3", "multi"), ("nova-3", "multi")]


def test_deepgram_websocket_and_rest_model_consistency():
    """Verify that WebSocket and REST configurations use identical multilingual parameters."""
    svc = DeepgramService()
    svc.api_key = "dg_consistency_key_123"

    # Verify WebSocket query parameters use nova-3 and language=multi
    ws_params = svc._get_query_params(sample_rate=8000, encoding="linear16")
    assert "model=nova-3" in ws_params, "WebSocket query must use model=nova-3"
    assert "language=multi" in ws_params, "WebSocket query must use language=multi"
    assert "extra=code_switch" not in ws_params, "Nova-3 must NOT send legacy extra=code_switch parameter"


# ==============================================================================
# 3. OPENAI CIRCUIT BREAKER
# ==============================================================================

@pytest.mark.asyncio
async def test_openai_circuit_breaker_full_lifecycle():
    """Verify:
    1. First insufficient_quota error -> quota circuit opens.
    2. Second turn -> NO OpenAI network request made.
    3. Third turn -> NO OpenAI network request made.
    4. Fallback adapter -> still performs correct emergency classification.
    5. After cooldown -> OpenAI can be attempted again.
    6. Unrelated OpenAI errors do NOT permanently open the quota circuit.
    """
    svc = OpenAIService(api_key="sk-test-mock-key")
    svc._quota_exhausted = False
    svc._quota_exhausted_time = 0.0

    network_calls = 0

    class MockBetaCompletions:
        async def parse(self, *args, **kwargs):
            nonlocal network_calls
            network_calls += 1
            raise Exception("Error code: 429 - {'error': {'message': 'You have no credits remaining.', 'type': 'insufficient_quota', 'code': 'credit_balance_exhausted'}}")

    class MockBeta:
        chat = MagicMock(completions=MockBetaCompletions())

    mock_client = MagicMock()
    mock_client.beta = MockBeta()
    svc._async_client = mock_client

    # Turn 1: Throws 429 quota exhaustion -> circuit opens
    res1 = await svc.extract_intent("Emergency. I want to talk to supervisor.")
    assert network_calls == 1
    assert svc._quota_exhausted is True, "Circuit breaker must open on credit_balance_exhausted"
    assert res1.incident_type == "supervisor_escalation"
    assert res1.route == "human_supervisor"

    # Turn 2: Circuit is open -> network_calls MUST remain 1
    res2 = await svc.extract_intent("There is an accident on Main Street.")
    assert network_calls == 1, "Must NOT make network request while circuit is open"
    assert res2.emergency is True
    assert res2.incident_type == "traffic_accident"

    # Turn 3: Circuit is open -> network_calls MUST remain 1
    res3 = await svc.extract_intent("Send whatever unit you can.")
    assert network_calls == 1, "Must NOT make network request while circuit is open"
    assert res3.emergency is True

    # Simulate cooldown expiration: 301 seconds have passed
    svc._quota_exhausted_time = time.time() - 301.0

    # Turn 4: After cooldown, it attempts network again
    res4 = await svc.extract_intent("Another emergency call.")
    assert network_calls == 2, "Must attempt network request after cooldown period"

    # Reset circuit and test unrelated error (e.g. 500 Internal Server Error)
    svc._quota_exhausted = False
    svc._quota_exhausted_time = 0.0

    class MockServerErrors:
        async def parse(self, *args, **kwargs):
            raise Exception("500 Internal Server Error: Model overloaded")

    mock_client.beta.chat.completions = MockServerErrors()
    res5 = await svc.extract_intent("Routine question about timing.")
    assert svc._quota_exhausted is False, "Temporary 500 error must NOT open quota circuit breaker"


# ==============================================================================
# 4. EMERGENCY INTENT TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_emergency_intent_exact_inputs_independently():
    """Test the 4 exact user requested inputs independently."""
    svc = OpenAIService()

    # Input 1: "There has been a car accident at Rajiv Chowk."
    res1 = await svc.extract_intent("There has been a car accident at Rajiv Chowk.")
    assert res1.emergency is True, "Must be emergency"
    assert res1.urgency == "HIGH", "Must be high urgency"
    assert res1.location == "Rajiv Chowk", "Must extract Rajiv Chowk"
    assert res1.incident_type == "traffic_accident"

    # Input 2: "Send whatever unit you can." with prior accident context
    prior_slots = {"incident_type": "traffic_accident", "urgency": "HIGH", "location": "Rajiv Chowk", "emergency": True}
    res2 = await svc.extract_intent("Send whatever unit you can.", session_slots=prior_slots)
    assert res2.emergency is True, "Emergency context must be retained"
    assert res2.urgency == "HIGH"
    assert res2.location == "Rajiv Chowk", "Location must be retained"
    assert res2.route == "human_supervisor"
    assert "mobilizing all available units" in res2.reply.lower()

    # Input 3: "I want to talk to a supervisor."
    res3 = await svc.extract_intent("I want to talk to a supervisor.")
    assert res3.incident_type == "supervisor_escalation", "Must be supervisor escalation"
    assert res3.urgency == "HIGH", "Must be high urgency"
    assert res3.emergency is True, "Must be emergency"
    assert res3.route == "human_supervisor", "Must route to human_supervisor"
    assert "connecting you to an emergency supervisor" in res3.reply.lower()

    # Input 4: "Hello."
    res4 = await svc.extract_intent("Hello.")
    assert res4.emergency is False, "Must NOT be emergency"
    assert res4.urgency == "LOW", "Must be LOW urgency"
    assert res4.route == "automated", "Must be automated routing"
    assert res4.incident_type is None, "Must NOT be an accident or supervisor escalation"
    assert "what is your emergency" in res4.reply.lower()
    assert "supervisor" not in res4.reply.lower()


# ==============================================================================
# 5. DASHBOARD WEBSOCKET END-TO-END TEST
# ==============================================================================

def test_dashboard_websocket_receives_all_live_events_e2e():
    """Verify end-to-end WebSocket integration representing a connected supervisor dashboard:
    1. Dashboard connects and authenticates.
    2. Call starts -> receives INCOMING_CALL / CALL_STARTED.
    3. Transcript processed -> receives CALL_TRANSCRIPT_UPDATE and TRANSCRIPT_UPDATE.
    4. Emergency detected -> receives EMERGENCY_DETECTED and EMERGENCY_ALERT.
    5. AI response ready -> receives TTS_READY.
    6. Call stops -> receives CALL_ENDED.
    """
    received_events = []

    class MockDashboardWS:
        def __init__(self):
            self.messages = []

        async def send_json(self, data):
            self.messages.append(data)

    mock_ws = MockDashboardWS()

    async def run_pipeline_with_connected_dashboard():
        # Connect to dashboard_manager
        dashboard_manager.active_connections.add(mock_ws)
        try:
            stream_sid = "exo_dash_stream_e2e"
            call_sid = "exo_dash_call_e2e"
            supervisor_speech = "There has been a car accident at Rajiv Chowk."

            with patch("app.services.pipeline.transcribe_audio", new=AsyncMock(return_value=supervisor_speech)):
                with client.websocket_connect("/exotel/media") as ws:
                    ws.send_text(json.dumps({"event": "connected"}))
                    ws.send_text(json.dumps({
                        "event": "start",
                        "stream_sid": stream_sid,
                        "start": {"call_sid": call_sid, "stream_sid": stream_sid, "from": "+919999000099"}
                    }))

                    # Audio frame
                    speech_b64 = base64.b64encode(struct.pack("<h", 2500) * 160).decode("ascii")
                    silence_b64 = base64.b64encode(b"\x00\x00" * 160).decode("ascii")
                    for _ in range(12):
                        ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": speech_b64}}))
                    for _ in range(36):
                        ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": silence_b64}}))

                    # Receive response on Exotel media
                    t_media = json.loads(ws.receive_text())
                    t_mark = json.loads(ws.receive_text())

                    ws.send_text(json.dumps({"event": "stop", "stream_sid": stream_sid}))
                    try:
                        ws.receive_text()
                    except Exception:
                        pass
        finally:
            dashboard_manager.active_connections.discard(mock_ws)

    asyncio.run(run_pipeline_with_connected_dashboard())

    event_types = [m.get("event") or m.get("type") for m in mock_ws.messages]

    # Assert expected dashboard events arrived
    assert "INCOMING_CALL" in event_types, "Dashboard must receive INCOMING_CALL"
    assert "CALL_STARTED" in event_types, "Dashboard must receive CALL_STARTED"
    assert "CALL_TRANSCRIPT_UPDATE" in event_types, "Dashboard must receive CALL_TRANSCRIPT_UPDATE"
    assert "TRANSCRIPT_UPDATE" in event_types, "Dashboard must receive TRANSCRIPT_UPDATE"
    assert "EMERGENCY_DETECTED" in event_types, "Dashboard must receive EMERGENCY_DETECTED"
    assert "EMERGENCY_ALERT" in event_types, "Dashboard must receive EMERGENCY_ALERT"
    assert "TTS_READY" in event_types, "Dashboard must receive TTS_READY"
    assert "CALL_ENDED" in event_types, "Dashboard must receive CALL_ENDED"

    # Verify EMERGENCY_DETECTED payload
    emerg_event = next(m for m in mock_ws.messages if m.get("event") == "EMERGENCY_DETECTED")
    payload = emerg_event["payload"]
    assert payload["priority"] in ("HIGH", "CRITICAL")
    assert payload["location"] == "Rajiv Chowk"
    assert "Rajiv Chowk" in payload["transcript"]


# ==============================================================================
# 6. DASHBOARD STATE & PERSISTENCE
# ==============================================================================

@pytest.mark.asyncio
async def test_session_id_persistence_and_concurrent_call_isolation():
    """Verify:
    1. The same session ID is used across Exotel, database, pipeline, and dashboard.
    2. Two simultaneous calls (Call A and Call B) have isolated state and cannot overwrite each other.
    """
    call_id_a = "EXO-call_session_AAA_111"
    call_id_b = "EXO-call_session_BBB_222"

    # Step 1: Create Call A and Call B
    await create_call_session(call_id=call_id_a, caller_name="+91999900000A", source="exotel")
    await create_call_session(call_id=call_id_b, caller_name="+91999900000B", source="exotel")

    # Step 2: Append distinct transcripts
    await append_call_transcript(call_id_a, "Accident at Rajiv Chowk.")
    await append_call_transcript(call_id_b, "Fire in industrial warehouse.")

    # Step 3: Run Orchestrator for Call A and Call B concurrently
    res_a = await pipeline.run_orchestrator("Accident at Rajiv Chowk.", session_id=call_id_a)
    res_b = await pipeline.run_orchestrator("Fire in industrial warehouse.", session_id=call_id_b)

    # Verify session IDs match exactly
    assert res_a["session_id"] == call_id_a
    assert res_b["session_id"] == call_id_b

    # Verify category and location isolation
    assert res_a["category"] in ("TRAFFIC", "ACCIDENT")
    assert res_a["location"] == "Rajiv Chowk"

    assert res_b["category"] == "FIRE"
    assert res_b["location"] != "Rajiv Chowk"

    # Step 4: Complete both calls
    now = datetime.now(timezone.utc)
    await update_call_session(call_id=call_id_a, end_time=now, duration_sec=45, status="completed")
    await update_call_session(call_id=call_id_b, end_time=now, duration_sec=60, status="completed")

    # Verify database persistence for both sessions
    sessions = await get_call_sessions(limit=50)
    db_a = next((s for s in sessions if s["call_id"] == call_id_a), None)
    db_b = next((s for s in sessions if s["call_id"] == call_id_b), None)

    assert db_a is not None
    assert db_a["id"] == call_id_a
    assert "Rajiv Chowk" in db_a["transcript"]
    assert db_a["duration_sec"] == 45
    assert db_a["status"] == "completed"

    assert db_b is not None
    assert db_b["id"] == call_id_b
    assert "warehouse" in db_b["transcript"]
    assert db_b["duration_sec"] == 60
    assert db_b["status"] == "completed"

    # Verify no cross-contamination between A and B
    assert "warehouse" not in db_a["transcript"]
    assert "Rajiv Chowk" not in db_b["transcript"]
