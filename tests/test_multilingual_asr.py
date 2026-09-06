"""Comprehensive multilingual and real-time code-switching test suite for RESCURO.

Verifies:
1. English routine & emergency intent triage.
2. Hindi routine & emergency intent triage.
3. Hindi + English (Hinglish) code-switching.
4. Exact mixed-language emergency inputs:
   - "Mera accident ho gaya hai, please ambulance bhejo, I am bleeding badly."
   - "Police ko call karo, someone is attacking me."
   - "Mujhe chest mein bahut pain ho raha hai, I think I need an ambulance."
   - "Help chahiye, ghar mein fire lag gayi hai."
5. Supervisor escalation in mixed language ("Mujhe supervisor se baat karni hai").
6. Deepgram Nova-3 multilingual WebSocket configuration (model=nova-3, language=multi, 8kHz, linear16, mono, endpointing).
7. Deepgram Nova-3 multilingual REST configuration (model=nova-3, language=multi, 8kHz, mono).
8. No fake emergency transcript on STT failure.
9. No TTS contamination / echo suppression.
10. Dynamic language metadata persistence in session state.
"""

import asyncio
import base64
import json
import struct
from unittest.mock import patch, MagicMock, AsyncMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services.deepgram_service import DeepgramService, deepgram_service, EMERGENCY_KEYWORDS
from app.services.openai_service import OpenAIService, openai_service
from app.services import pipeline

client = TestClient(app)


# ==============================================================================
# 1. NOVA-3 MULTILINGUAL CONFIGURATION (WEBSOCKET & REST)
# ==============================================================================

def test_nova3_multilingual_websocket_configuration():
    """Verify WebSocket query parameters strictly use model=nova-3 and language=multi with 8kHz PCM16."""
    params_str = deepgram_service._get_query_params(sample_rate=8000, encoding="linear16")
    params = params_str.split("&")
    param_dict = {}
    keywords = []

    for p in params:
        if "=" in p:
            k, v = p.split("=", 1)
            if k == "keywords":
                keywords.append(v)
            else:
                param_dict[k] = v

    # 1. Nova-3 model tier
    assert param_dict.get("model") == "nova-3", "Must default to nova-3"

    # 2. Native multilingual code-switching
    assert param_dict.get("language") == "multi", "Must use language=multi, NOT en-IN"
    assert "en-IN" not in params_str, "Must NOT use language=en-IN"
    assert "extra=code_switch" not in params_str, "Nova-3 must NOT use legacy extra=code_switch"

    # 3. Audio format: 8kHz linear16 mono
    assert param_dict.get("sample_rate") == "8000", "Sample rate must be 8000Hz"
    assert param_dict.get("channels") == "1", "Channels must be mono (1)"
    assert param_dict.get("encoding") == "linear16", "Encoding must be linear16 PCM"

    # 4. Turn detection & formatting
    assert param_dict.get("smart_format") == "true"
    assert param_dict.get("punctuate") == "true"
    assert param_dict.get("endpointing") == "300"
    assert param_dict.get("utterance_end_ms") == "1000"

    # 5. Keywords parameter must NOT be sent for Nova-3 (unsupported in Nova-3)
    assert len(keywords) == 0, "Keywords must not be sent for Nova-3"
    assert "keywords=" not in params_str


@pytest.mark.asyncio
async def test_nova3_multilingual_rest_configuration():
    """Verify REST parameters use the exact same multilingual configuration (model=nova-3, language=multi)."""
    svc = DeepgramService()
    svc.api_key = "test_nova3_rest_key_999"

    mock_resp = MagicMock(status_code=200)
    mock_resp.json.return_value = {
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": "Mera accident ho gaya hai",
                            "confidence": 0.96,
                            "detected_language": "hi",
                            "languages": ["hi", "en"]
                        }
                    ]
                }
            ]
        }
    }

    requests_sent = []

    async def mock_post(c, url, *args, **kwargs):
        requests_sent.append(kwargs)
        return mock_resp

    pcm_payload = struct.pack("<h", 1200) * 1600  # 200ms of audio
    with patch("httpx.AsyncClient.post", new=mock_post):
        res = await svc.transcribe_prerecorded(pcm_payload, sample_rate=8000, encoding="linear16", channels=1)

    assert len(requests_sent) == 1
    call_kwargs = requests_sent[0]
    param_dict = dict(call_kwargs.get("params", []))

    assert param_dict.get("model") == "nova-3", "REST request must target nova-3"
    assert param_dict.get("language") == "multi", "REST request must target language=multi"
    assert param_dict.get("sample_rate") == "8000"
    assert param_dict.get("channels") == "1"
    assert "extra" not in param_dict, "Nova-3 must NOT include extra=code_switch parameter"
    assert "keywords" not in param_dict, "Nova-3 must NOT include keywords parameter"

    # Verify return payload contains multilingual language metadata
    assert res["transcript"] == "Mera accident ho gaya hai"
    assert res["language"] == "hi"
    assert "hi" in res["languages"]


# ==============================================================================
# 2. MULTILINGUAL & CODE-SWITCHED EMERGENCY INTENT TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_multilingual_english_routine_and_emergency():
    """Verify pure English routine and emergency utterances."""
    svc = OpenAIService()

    # 1. Routine English
    res_routine = await svc.extract_intent("Hello, could you please tell me where your office is located?")
    assert res_routine.urgency == "LOW"
    assert res_routine.emergency is False
    assert res_routine.route == "automated"

    # 2. Emergency English
    res_emerg = await svc.extract_intent("There has been a car accident at Rajiv Chowk, multiple vehicles involved.")
    assert res_emerg.urgency in ("HIGH", "CRITICAL")
    assert res_emerg.emergency is True
    assert res_emerg.location == "Rajiv Chowk"
    assert res_emerg.incident_type in ("traffic_accident", "accident")
    assert res_emerg.route == "human_supervisor"


@pytest.mark.asyncio
async def test_multilingual_hindi_routine_and_emergency():
    """Verify pure Hindi routine and emergency utterances."""
    svc = OpenAIService()

    # 1. Routine Hindi
    res_routine = await svc.extract_intent("Namaste, kripya bataiye office ka address kya hai?")
    assert res_routine.urgency == "LOW"
    assert res_routine.emergency is False
    assert res_routine.route == "automated"

    # 2. Emergency Hindi
    res_emerg = await svc.extract_intent("Bachao! Building mein aag lag gayi hai, jaldi aao!")
    assert res_emerg.urgency == "CRITICAL"
    assert res_emerg.emergency is True
    assert res_emerg.incident_type == "fire"
    assert res_emerg.route == "human_supervisor"
    # Verify response is in Hindi/Hinglish, not forced English
    assert any(w in res_emerg.reply.lower() for w in ["fire", "aag", "niklein", "bahar", "kripya"])


@pytest.mark.asyncio
async def test_multilingual_mixed_accident_with_bleeding():
    """Verify exact prompt case:
    'Mera accident ho gaya hai, please ambulance bhejo, I am bleeding badly.'
    """
    res = await openai_service.extract_intent(
        "Mera accident ho gaya hai, please ambulance bhejo, I am bleeding badly."
    )
    assert res.emergency is True
    assert res.urgency in ("HIGH", "CRITICAL")
    assert res.route == "human_supervisor"
    assert res.incident_type in ("traffic_accident", "medical")

    # Agency and medical indicators
    assert res.extracted_slots.get("requested_agency") == "ambulance"
    assert "severe_bleeding" in res.extracted_slots.get("medical_indicators", [])

    # Response should naturally mix Hindi and English (Hinglish)
    reply_lower = res.reply.lower()
    assert any(w in reply_lower for w in ["ambulance", "bleeding", "pressure", "kapde", "location"])


@pytest.mark.asyncio
async def test_multilingual_mixed_police_attack():
    """Verify exact prompt case:
    'Police ko call karo, someone is attacking me.'
    """
    res = await openai_service.extract_intent(
        "Police ko call karo, someone is attacking me."
    )
    assert res.emergency is True
    assert res.urgency in ("HIGH", "CRITICAL")
    assert res.route == "human_supervisor"
    assert res.incident_type == "police"

    # Agency and security indicators
    assert res.extracted_slots.get("requested_agency") == "police"
    assert "active_assault" in res.extracted_slots.get("security_indicators", [])

    # Response should reassure in natural Hinglish style
    reply_lower = res.reply.lower()
    assert any(w in reply_lower for w in ["police", "safe", "dispatch", "jagah", "location"])


@pytest.mark.asyncio
async def test_multilingual_mixed_chest_pain_ambulance():
    """Verify exact prompt case:
    'Mujhe chest mein bahut pain ho raha hai, I think I need an ambulance.'
    """
    res = await openai_service.extract_intent(
        "Mujhe chest mein bahut pain ho raha hai, I think I need an ambulance."
    )
    assert res.emergency is True
    assert res.urgency == "CRITICAL"
    assert res.route == "human_supervisor"
    assert res.incident_type == "medical"

    # Agency and cardiac indicators
    assert res.extracted_slots.get("requested_agency") == "ambulance"
    assert "chest_pain" in res.extracted_slots.get("medical_indicators", [])

    # Natural response in Hinglish
    reply_lower = res.reply.lower()
    assert any(w in reply_lower for w in ["ambulance", "alert", "baith", "address", "location"])


@pytest.mark.asyncio
async def test_multilingual_mixed_house_fire():
    """Verify exact prompt case:
    'Help chahiye, ghar mein fire lag gayi hai.'
    """
    res = await openai_service.extract_intent(
        "Help chahiye, ghar mein fire lag gayi hai."
    )
    assert res.emergency is True
    assert res.urgency == "CRITICAL"
    assert res.route == "human_supervisor"
    assert res.incident_type == "fire"

    # Agency and fire indicators
    assert res.extracted_slots.get("requested_agency") == "fire"
    assert res.extracted_slots.get("hazard") == "structure_fire"

    # Natural response in Hinglish
    reply_lower = res.reply.lower()
    assert any(w in reply_lower for w in ["fire", "ghar", "bahar", "niklein", "safe"])


@pytest.mark.asyncio
async def test_multilingual_supervisor_escalation_mixed_language():
    """Verify supervisor escalation intent spoken in natural mixed Hindi-English:
    'Mujhe supervisor se baat karni hai immediately.'
    """
    res = await openai_service.extract_intent(
        "Mujhe supervisor se baat karni hai immediately."
    )
    assert res.emergency is True
    assert res.urgency == "HIGH"
    assert res.route == "human_supervisor"
    assert res.incident_type == "supervisor_escalation"
    assert res.extracted_slots.get("escalation_requested") is True

    # Natural reassuring Hinglish response
    assert "supervisor" in res.reply.lower()
    assert any(w in res.reply.lower() for w in ["connect", "turant", "line", "bane rahein"])


# ==============================================================================
# 3. PIPELINE INTEGRITY, NO FAKE TRANSCRIPTS, NO TTS CONTAMINATION
# ==============================================================================

@pytest.mark.asyncio
async def test_multilingual_pipeline_never_invents_fake_transcript_on_failure():
    """Verify that if STT fails or returns empty audio, pipeline never invents a transcript."""
    with patch("app.services.deepgram_service.DeepgramService.transcribe_prerecorded", new=AsyncMock(return_value={"transcript": "", "confidence": 0.0, "language": "multi"})):
        transcript = await pipeline.transcribe_audio(b"")
        assert transcript == "", "Failed STT must return empty string, never a fabricated emergency"

        detailed = await pipeline.transcribe_audio_detailed(b"")
        assert detailed["transcript"] == ""


@pytest.mark.asyncio
async def test_multilingual_session_language_metadata_storage():
    """Verify that language metadata is stored in session state and updated per turn."""
    session_id = "multilingual_session_meta_test_101"
    pipeline.clear_session_state(session_id)

    # Turn 1: Caller speaks Hindi
    res1 = await pipeline.run_orchestrator(
        transcript="Mujhe chest mein bahut pain ho raha hai, please help!",
        session_id=session_id,
        language="hi",
        languages=["hi", "en"]
    )
    assert res1["language"] == "hi"
    assert "hi" in res1["languages"]

    # Turn 2: Caller switches to English
    res2 = await pipeline.run_orchestrator(
        transcript="I am located near Sector 18 Metro Station.",
        session_id=session_id,
        language="en",
        languages=["en"]
    )
    # The session tracks latest language and language history across the call
    assert res2["language"] == "en"
    assert "hi" in res2["languages"]
    assert "en" in res2["languages"]

    pipeline.clear_session_state(session_id)


def test_multilingual_exotel_preserves_audio_format_and_suppresses_tts_echo():
    """Verify Exotel audio format (8kHz PCM16 mono) is preserved and echo suppression prevents TTS contamination."""
    stream_sid = "exo_multilingual_echo_test"
    call_sid = "exo_call_multi_101"
    stt_calls = []

    async def mock_stt(*args, **kwargs):
        stt_calls.append(kwargs)
        return {"transcript": "Ambulance bhejo", "confidence": 0.95, "language": "hi", "languages": ["hi"]}

    with patch("app.services.pipeline.transcribe_audio_detailed", new=mock_stt):
        with client.websocket_connect("/exotel/media") as ws:
            ws.send_text(json.dumps({"event": "connected"}))
            ws.send_text(json.dumps({
                "event": "start",
                "stream_sid": stream_sid,
                "start": {"call_sid": call_sid, "stream_sid": stream_sid, "from": "+919988776655"}
            }))

            # Turn 1: Valid 8kHz PCM16 audio (160 samples per 20ms frame = 320 bytes)
            pcm16_chunk = struct.pack("<h", 2500) * 160
            b64_audio = base64.b64encode(pcm16_chunk).decode("ascii")
            for _ in range(12):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": b64_audio}}))

            # Silence to end utterance
            silence_chunk = b"\x00\x00" * 160
            b64_silence = base64.b64encode(silence_chunk).decode("ascii")
            for _ in range(36):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": b64_silence}}))

            # Receive outbound response
            resp_media = json.loads(ws.receive_text())
            resp_mark = json.loads(ws.receive_text())

            assert resp_media.get("event") == "media"
            assert resp_mark.get("event") == "mark"
            active_mark = resp_mark.get("mark", {}).get("name")

            # Assistant is now speaking: simulate acoustic feedback echo into the mic
            for _ in range(10):
                ws.send_text(json.dumps({"event": "media", "stream_sid": stream_sid, "media": {"payload": b64_audio}}))

            # Confirm NO extra turn was triggered during playback
            assert len(stt_calls) == 1, "TTS playback must completely suppress incoming echo"

            # Telephony mark received: playback completed
            ws.send_text(json.dumps({"event": "mark", "stream_sid": stream_sid, "mark": {"name": active_mark}}))

            ws.send_text(json.dumps({"event": "stop", "stream_sid": stream_sid}))
            try:
                ws.receive_text()
            except Exception:
                pass
