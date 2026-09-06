"""RESCURO Core AI Pipeline: STT -> Orchestrator -> TTS.

This module is designed to be completely provider-agnostic and reusable across:
1. Inbound phone calls via Vobiz WebSocket (/vobiz/media)
2. Live Dispatcher Dashboard WebSocket (/ws/dashboard)
3. Testing and simulation harnesses

Currently implemented with modular asynchronous stubs ready to plug in
providers (Deepgram / Whisper for STT; ElevenLabs / Google / OpenAI for TTS).
"""

import base64
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.config import settings

logger = logging.getLogger("rescuro.pipeline")


from app.services.deepgram_service import deepgram_service
from app.services.openai_service import openai_service

# Per-session multi-turn conversation history and extracted slots
_session_conversations: Dict[str, list] = {}
_session_slots: Dict[str, Dict[str, Any]] = {}
_overridden_sessions: set = set()


def mark_session_overridden(session_id: str, overridden: bool = True):
    """Mark or unmark a session as overridden by a human supervisor."""
    if not session_id:
        return
    if overridden:
        _overridden_sessions.add(session_id)
        logger.info("Pipeline session %s marked as overridden by supervisor. Automated TTS halted.", session_id)
    else:
        _overridden_sessions.discard(session_id)
        logger.info("Pipeline session %s released back to AI autonomous operation.", session_id)


def is_session_overridden(session_id: str) -> bool:
    """Check if a session is currently taken over by a supervisor."""
    return bool(session_id and session_id in _overridden_sessions)


def clear_session_state(session_id: str):
    """Cleanly clear in-memory conversation history, slots, and override flag for a terminated session."""
    _session_conversations.pop(session_id, None)
    _session_slots.pop(session_id, None)
    _overridden_sessions.discard(session_id)


# ==============================================================================
# 1. Speech-to-Text (STT) Stage
# ==============================================================================

_last_stt_result: Dict[str, Any] = {}

async def transcribe_audio_detailed(
    audio_chunk: bytes | str,
    encoding: str = "linear16",
    sample_rate: int = 8000,
    language: Optional[str] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """Transcribe an incoming audio chunk or buffer with Nova-3 Multilingual (language=multi).

    Returns detailed dictionary containing:
    - transcript: raw genuine transcript text
    - confidence: STT model confidence
    - language: dominant detected language code
    - languages: list of all detected languages across words/turns
    """
    global _last_stt_result
    if isinstance(audio_chunk, str):
        try:
            raw_bytes = base64.b64decode(audio_chunk)
        except Exception:
            raw_bytes = audio_chunk.encode("utf-8")
    else:
        raw_bytes = audio_chunk

    logger.debug(
        "Received audio chunk for transcription: %d bytes (encoding=%s, rate=%d)",
        len(raw_bytes), encoding, sample_rate
    )

    if not raw_bytes:
        res = {"transcript": "", "confidence": 0.0, "language": "unknown", "languages": []}
        _last_stt_result = res
        return res

    # Deepgram Nova-3 multilingual transcription (REST / buffer)
    if encoding in ("pcm_mulaw", "mulaw"):
        mime_type = f"audio/x-mulaw;rate={sample_rate}"
    else:
        mime_type = "audio/wav"

    res = await deepgram_service.transcribe_prerecorded(
        raw_bytes,
        mime_type=mime_type,
        sample_rate=sample_rate,
        encoding=encoding,
        language=language,
        model=model
    )
    _last_stt_result = res
    return res


async def transcribe_audio(
    audio_chunk: bytes | str,
    encoding: str = "linear16",
    sample_rate: int = 8000
) -> str:
    """Transcribe an incoming audio chunk or buffer using DeepgramService.

    When configured with DEEPGRAM_API_KEY, delegates directly to Deepgram Nova-3 Multilingual (language=multi).
    Never manufactures a fake transcript when transcription fails or key is unconfigured.
    """
    res = await transcribe_audio_detailed(audio_chunk, encoding=encoding, sample_rate=sample_rate)
    return (res.get("transcript") or "").strip()


# ==============================================================================
# 2. Intelligence & Dispatch Orchestrator Stage
# ==============================================================================

async def run_orchestrator(
    transcript: str,
    session_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    language: Optional[str] = None,
    languages: Optional[list] = None
) -> Dict[str, Any]:
    """Analyze the caller's transcript and determine RESCURO's dispatch response.

    Maintains per-session conversation context (history and slots) across turns.
    Integrates with OpenAIService structured triage while providing intelligent
    continuity across turns for emergencies, location updates, greetings, and
    dynamic multilingual code-switching.
    """
    cleaned_text = transcript.strip()
    session_key = session_id or f"rescuro_{int(datetime.now().timestamp())}"
    history = _session_conversations.setdefault(session_key, [])
    slots = _session_slots.setdefault(session_key, {})
    meta = dict(metadata or {})

    detected_lang = language or meta.get("language")
    detected_langs = languages or meta.get("languages") or ([detected_lang] if detected_lang else ["multi"])

    # Store language metadata in session slots across turns
    if detected_lang:
        slots["latest_language"] = detected_lang
        prior_langs = slots.get("languages", [])
        slots["languages"] = list(dict.fromkeys(prior_langs + detected_langs))

    # Extract intent, entities, and slots using OpenAIService
    extraction = await openai_service.extract_intent(
        cleaned_text,
        conversation_history=history,
        session_slots=slots
    )

    raw_urgency = extraction.urgency or "MEDIUM"
    urgency = "HIGH" if raw_urgency in ("HIGH", "CRITICAL") else raw_urgency
    category = "MEDICAL"
    if extraction.incident_type:
        inc = extraction.incident_type.upper()
        if "FIRE" in inc:
            category = "FIRE"
        elif "POLICE" in inc or "SECURITY" in inc:
            category = "POLICE"
        elif "TRAFFIC" in inc or "ACCIDENT" in inc:
            category = "TRAFFIC"
        elif "INQUIRY" in inc:
            category = "INQUIRY"
        elif "SUPERVISOR" in inc or "ESCALAT" in inc:
            category = "SUPERVISOR_ESCALATION"
        elif "EMERGENCY" in inc:
            category = "EMERGENCY"
        else:
            category = inc
    else:
        lower_text = cleaned_text.lower()
        if "fire" in lower_text or "smoke" in lower_text or "aag" in lower_text:
            category = "FIRE"
        elif "intruder" in lower_text or "police" in lower_text or "robbery" in lower_text or "attack" in lower_text:
            category = "POLICE"
        elif "accident" in lower_text or "crash" in lower_text or "durghatna" in lower_text:
            category = "TRAFFIC"
        elif "ambulance" in lower_text or "bleeding" in lower_text or "hospital" in lower_text or "chest" in lower_text or "chot" in lower_text or "dard" in lower_text:
            category = "MEDICAL"
        elif "supervisor" in lower_text:
            category = "SUPERVISOR_ESCALATION"
        elif "emergency" in lower_text or "bachao" in lower_text or "madad" in lower_text or "khatra" in lower_text:
            category = "EMERGENCY"

    # Update session slots
    if extraction.location:
        slots["location"] = extraction.location
    if extraction.incident_type:
        slots["incident_type"] = extraction.incident_type
    slots["urgency"] = urgency
    slots["category"] = category

    response_text = extraction.reply or (
        f"RESCURO Emergency Dispatch received your report. Units have been alerted with {urgency} priority. "
        "Help is being routed to your location now. Please stay on the line."
    )

    # Append to session conversation history
    history.append({"role": "user", "content": cleaned_text})
    history.append({"role": "assistant", "content": response_text})

    meta["language"] = slots.get("latest_language") or detected_lang or "multi"
    meta["languages"] = slots.get("languages") or detected_langs

    result = {
        "session_id": session_key,
        "transcript": cleaned_text,
        "response_text": response_text,
        "urgency": urgency,
        "category": category,
        "location": slots.get("location"),
        "route": extraction.route,
        "emergency": extraction.emergency,
        "status": "DISPATCH_EN_ROUTE" if extraction.emergency else "ACTIVE",
        "units_assigned": [f"{category}-ALPHA-1", "RESCURO-DRONE-02"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "language": meta["language"],
        "languages": meta["languages"],
        "metadata": meta
    }

    logger.info(
        "Orchestrator decision for session %s: Category=%s, Urgency=%s, Location=%s",
        session_key, category, urgency, slots.get("location")
    )
    return result


# ==============================================================================
# 3. Text-to-Speech (TTS) Stage
# ==============================================================================

from app.services.tts_service import TTSService

_tts_service = TTSService()


async def synthesize_speech(
    response_text: str,
    voice_id: Optional[str] = None,
    output_format: str = "pcm_mulaw"
) -> bytes:
    """Synthesize verbal response text into audio bytes.

    Provider integration point:
    Synthesizes real audio using TTSService (Deepgram Aura / OpenAI / ElevenLabs)
    or falls back to ITU-T G.711 μ-law generated tone if API keys are unconfigured.
    """
    logger.debug("Synthesizing speech for: '%s' (format=%s)", response_text[:50], output_format)
    return await _tts_service.synthesize_audio(response_text)


# ==============================================================================
# 4. Consolidated End-to-End Pipeline Helper
# ==============================================================================

async def process_voice_turn(
    audio_chunk: bytes | str,
    session_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Executes the full STT -> Orchestrator -> TTS sequence for a voice turn.

    Returns:
        dict: {
            "transcript": str,
            "orchestrator": dict,
            "audio_bytes": bytes,
            "audio_base64": str
        }
    """
    # 1. Transcribe audio
    transcript = await transcribe_audio(audio_chunk)

    # 2. Orchestrate response
    orch_result = await run_orchestrator(transcript, session_id=session_id, metadata=metadata)

    # 3. Guard against AI speaking over supervisor
    if session_id and is_session_overridden(session_id):
        logger.info("Session %s under supervisor takeover: Automated TTS suppressed in process_voice_turn.", session_id)
        return {
            "transcript": transcript,
            "orchestrator": orch_result,
            "audio_bytes": b"",
            "audio_base64": "",
            "tts_halted": True,
            "status": "SUPERVISOR_ACTIVE"
        }

    # 4. Synthesize speech
    audio_bytes = await synthesize_speech(orch_result["response_text"])
    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    return {
        "transcript": transcript,
        "orchestrator": orch_result,
        "audio_bytes": audio_bytes,
        "audio_base64": audio_b64
    }
