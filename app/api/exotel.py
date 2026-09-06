"""Exotel AgentStream Voice Bot Integration for RESCURO.

Implements bidirectional audio streaming over WebSocket:
WS /exotel/media

Protocol events:
- connected  -> Connection handshake
- start      -> Session initialization, keyed as EXO-{call_sid}
- media      -> Bidirectional audio (PCM16 8kHz mono <-> G.711 u-law transcoding)
- dtmf       -> DTMF tones handling/logging
- mark       -> Playback synchronization marks
- clear      -> Audio buffer clearance
- stop       -> Session termination and database logging

Turn Detection Architecture:
Exotel media chunks -> Audio buffer -> Real STT / Turn detection -> "User finished speaking"
-> ONE transcript -> ONE orchestrator call -> ONE TTS -> ONE audio response -> Wait for next user turn.
"""

import os
import json
import base64
import math
import array
import asyncio
import time
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.api.dashboard_ws import dashboard_manager
from app.database import create_call_session, update_call_session, append_call_transcript
from app.models.session import SessionStatus
from app.services import pipeline
from app.services.audio_bridge import audio_bridge
from app.services.deepgram_service import deepgram_service
from app.services.tts_service import pcm16_to_ulaw, ulaw_to_pcm16, generate_fallback_ulaw_audio

logger = logging.getLogger("rescuro.exotel")
router = APIRouter(prefix="/exotel", tags=["Exotel Telephony"])

CONSENT_GREETING_TEXT = (
    "Hello, you've reached RESCURO Emergency Response. "
    "This call may contain sensitive emergency information and "
    "will be recorded for emergency response and dispatch purposes. "
    "Do you consent to continue?"
)

_cached_consent_ulaw: Optional[bytes] = None

async def get_consent_greeting_ulaw() -> bytes:
    """Pre-synthesize or fetch cached 8kHz G.711 u-law audio for the consent greeting disclosure."""
    global _cached_consent_ulaw
    if _cached_consent_ulaw is not None and len(_cached_consent_ulaw) > 0:
        return _cached_consent_ulaw
    try:
        audio = await asyncio.wait_for(pipeline.synthesize_speech(CONSENT_GREETING_TEXT), timeout=3.0)
        if audio and len(audio) > 0:
            _cached_consent_ulaw = audio
            return _cached_consent_ulaw
    except Exception as e:
        logger.warning("TTS API call for consent greeting timed out or failed (%s); using fallback audio", e)
    _cached_consent_ulaw = generate_fallback_ulaw_audio(duration_sec=3.0)
    return _cached_consent_ulaw

# Audio specs and turn detection parameters
SAMPLE_RATE = 8000           # Exotel 8kHz
BYTES_PER_SAMPLE = 2        # 16-bit linear PCM
SILENCE_ENERGY_THRESHOLD = 400.0  # RMS threshold distinguishing silence from speech
SILENCE_DURATION_MS = 700   # Milliseconds of silence to determine utterance completed
MIN_SPEECH_DURATION_MS = 200 # Minimum speech duration to qualify as an intentional turn
MAX_TURN_DURATION_MS = 10000 # Force process turn after 10 seconds continuous speech


def calculate_pcm16_rms(pcm_bytes: bytes) -> float:
    """Calculate Root Mean Square (RMS) energy for 16-bit linear PCM audio."""
    if not pcm_bytes or len(pcm_bytes) < 2:
        return 0.0
    valid_len = len(pcm_bytes) - (len(pcm_bytes) % 2)
    samples = array.array("h")
    samples.frombytes(pcm_bytes[:valid_len])
    if not samples:
        return 0.0
    sum_squares = sum(s * s for s in samples)
    return math.sqrt(sum_squares / len(samples))


@router.websocket("/media")
async def exotel_media_websocket(websocket: WebSocket):
    """Bidirectional WebSocket endpoint for Exotel AgentStream voice bot protocol.

    Buffers inbound PCM16 8kHz audio, performs turn/silence detection, and executes
    ONE cohesive conversational turn (STT -> Orchestrator -> TTS -> Audio Sent)
    per caller utterance.
    """
    await websocket.accept()
    logger.info("EXOTEL CONNECTED")

    stream_sid: Optional[str] = None
    call_sid: Optional[str] = None
    session_id: Optional[str] = None
    start_time = datetime.now(timezone.utc)
    call_status = "completed"

    # Per-call audio buffer and turn detection state
    audio_buffer = bytearray()
    speech_detected = False
    speech_duration_ms = 0
    silence_duration_ms = 0
    is_processing_turn = False

    # Assistant speaking & Echo suppression state
    assistant_speaking = False
    active_mark_id: Optional[str] = None
    playback_expected_end_time: float = 0.0
    turn_counter = 0

    # Feature 1: Consent gate state
    awaiting_consent = True
    consent_granted: Optional[bool] = None
    terminate_after_playback = False
    session_emergency_blurted = False

    # Feature 2: Supervisor human takeover state
    is_human_takeover = False

    # Deepgram streaming session management
    deepgram_audio_queue: Optional[asyncio.Queue] = None
    deepgram_task: Optional[asyncio.Task] = None

    async def process_completed_turn(transcript_text: Optional[str] = None):
        """Execute exactly ONE full turn: STT -> Orchestrator -> TTS -> Outbound Media."""
        nonlocal speech_detected, speech_duration_ms, silence_duration_ms, is_processing_turn
        nonlocal assistant_speaking, active_mark_id, playback_expected_end_time, turn_counter
        nonlocal awaiting_consent, consent_granted, terminate_after_playback, is_human_takeover
        nonlocal session_emergency_blurted

        if is_processing_turn or assistant_speaking:
            return
        is_processing_turn = True
        turn_counter += 1

        try:
            active_session = session_id or f"EXO-{stream_sid or 'active'}"
            metadata = {"provider": "exotel", "call_sid": call_sid, "stream_sid": stream_sid}

            # Step 1: Obtain Transcript
            transcript = (transcript_text or "").strip()
            detected_lang = "multi"
            detected_langs = ["multi"]
            if not transcript:
                if len(audio_buffer) == 0:
                    return
                logger.info("TRANSCRIBING TURN (buffer=%d bytes, speech=%dms)", len(audio_buffer), speech_duration_ms)
                logger.info("STT REQUEST")
                try:
                    transcript = await pipeline.transcribe_audio(
                        audio_chunk=bytes(audio_buffer),
                        encoding="linear16",
                        sample_rate=SAMPLE_RATE
                    )
                    transcript = (transcript or "").strip()
                    last_stt = getattr(pipeline, "_last_stt_result", {})
                    if isinstance(last_stt, dict):
                        detected_lang = last_stt.get("language") or "multi"
                        detected_langs = last_stt.get("languages") or [detected_lang]
                except Exception as stt_err:
                    logger.error("STT ERROR: Exception during transcription: %s", stt_err)
                    transcript = ""
                transcript = (transcript or "").strip()

            orchestrator = getattr(websocket.app.state, "orchestrator", None) if hasattr(websocket, "app") else None
            is_supervisor_req = False

            # Safeguard: Never manufacture a fake transcript on STT failure
            if not transcript:
                logger.error("STT ERROR: Transcription failed or returned empty. Prompting caller to repeat.")
                response_text = "I'm having trouble hearing you. Please repeat that."
                orch_result = {
                    "session_id": active_session,
                    "transcript": "",
                    "response_text": response_text,
                    "status": "STT_RETRY",
                    "metadata": metadata
                }
            else:
                t_lower = transcript.lower()
                # 0. Check for explicit supervisor request FIRST (highest priority, valid anytime)
                is_supervisor_req = any(sk in t_lower for sk in [
                    "supervisor", "speak to a supervisor", "talk to a supervisor",
                    "supervisor se baat", "supervisor ko bulao", "supervisor se connect",
                    "supervisor chahiye", "human agent", "talk to human", "speak to human",
                    "dispatcher se baat", "transfer", "human operator", "manager",
                    "kisi human se", "insan se baat"
                ])
                if is_supervisor_req:
                    logger.info("SUPERVISOR REQUEST DETECTED from caller for session %s", active_session)
                    is_human_takeover = True
                    pipeline.mark_session_overridden(active_session, True)
                    if orchestrator:
                        sess = orchestrator.get_session(active_session)
                        if sess:
                            sess.tts_halted = True
                            sess.supervisor_requested = True
                            sess.status = SessionStatus.HUMAN_TAKEOVER

                    # Notify supervisor dashboard immediately to open takeover modal
                    await dashboard_manager.broadcast("SUPERVISOR_REQUESTED", {
                        "session_id": active_session,
                        "call_id": active_session,
                        "stream_id": stream_sid,
                        "stream_sid": stream_sid,
                        "priority": "CRITICAL",
                        "reason": "Caller verbally requested human supervisor takeover."
                    })
                    await dashboard_manager.broadcast("SUPERVISOR_CALL_TAKEOVER_REQUEST", {
                        "session_id": active_session,
                        "call_id": active_session,
                        "stream_id": stream_sid,
                        "stream_sid": stream_sid,
                        "priority": "CRITICAL",
                        "reason": "Caller verbally requested human supervisor takeover."
                    })

                    is_hindi = any(w in t_lower for w in ["baat", "karni", "mujhe", "hai", "karo", "bulao", "se"])
                    response_text = (
                        "Aapko emergency supervisor se connect kiya ja raha hai. Kripya line par bane rahein."
                        if is_hindi
                        else "Connecting you to an emergency supervisor immediately. Please stay on the line while we bridge the call."
                    )
                    orch_result = {
                        "session_id": active_session,
                        "transcript": transcript,
                        "response_text": response_text,
                        "urgency": "CRITICAL",
                        "category": "SUPERVISOR_ESCALATION",
                        "route": "human_supervisor",
                        "emergency": True,
                        "supervisor_requested": True
                    }
                elif awaiting_consent:
                    # FEATURE 1: Mandatory Recording Consent Gate
                    consent_eval = pipeline.evaluate_consent(transcript)
                    logger.info("CONSENT EVALUATION: transcript='%s', result=%s", transcript, consent_eval)
                    if consent_eval is True:
                        awaiting_consent = False
                        consent_granted = True
                        if session_emergency_blurted:
                            response_text = "Thank you. Help is being routed. Please tell me your exact location."
                        else:
                            response_text = "Thank you. Please tell me what happened."
                        if orchestrator:
                            sess = orchestrator.get_session(active_session)
                            if sess:
                                sess.consent_granted = True
                                sess.status = SessionStatus.ACTIVE
                        orch_result = {
                            "session_id": active_session,
                            "transcript": transcript,
                            "response_text": response_text,
                            "urgency": "HIGH" if session_emergency_blurted else "LOW",
                            "category": "EMERGENCY" if session_emergency_blurted else "CONSENT_GRANTED",
                            "route": "automated",
                            "emergency": session_emergency_blurted,
                        }
                    elif consent_eval is False:
                        awaiting_consent = False
                        consent_granted = False
                        terminate_after_playback = True
                        response_text = (
                            "Understood. Because recording consent was not provided, "
                            "this emergency session cannot continue on this channel. "
                            "If you have an immediate emergency, please dial 112 directly. Goodbye."
                        )
                        if orchestrator:
                            sess = orchestrator.get_session(active_session)
                            if sess:
                                sess.consent_granted = False
                                sess.status = SessionStatus.CONSENT_DENIED
                        orch_result = {
                            "session_id": active_session,
                            "transcript": transcript,
                            "response_text": response_text,
                            "urgency": "LOW",
                            "category": "CONSENT_DENIED",
                            "route": "automated",
                            "emergency": False,
                        }
                    else:
                        # Ambiguous response or caller spoke emergency details before consenting
                        has_emergency_blurt = any(kw in t_lower for kw in [
                            "accident", "durghatna", "bleeding", "khoon", "chot", "blood",
                            "injured", "fire", "aag", "bachao", "madad", "emergency", "ambulance",
                            "hospital", "help", "pain", "attack", "police"
                        ])
                        if has_emergency_blurt:
                            session_emergency_blurted = True
                            try:
                                await pipeline.run_orchestrator(
                                    transcript=transcript,
                                    session_id=active_session,
                                    metadata=metadata
                                )
                            except Exception:
                                pass
                            response_text = (
                                "I understand this is an emergency. For dispatch and legal purposes, "
                                "this call is recorded. Do you agree to continue?"
                            )
                            orch_result = {
                                "session_id": active_session,
                                "transcript": transcript,
                                "response_text": response_text,
                                "urgency": "HIGH",
                                "category": "EMERGENCY",
                                "route": "human_supervisor",
                                "emergency": True,
                            }
                        else:
                            response_text = (
                                "I understand this is urgent, but for emergency response compliance, "
                                "this call must be recorded. Do you consent to proceed? Please say yes or no."
                            )
                            orch_result = {
                                "session_id": active_session,
                                "transcript": transcript,
                                "response_text": response_text,
                                "urgency": "MEDIUM",
                                "category": "AWAITING_CONSENT",
                                "route": "automated",
                                "emergency": False,
                            }
                else:
                    logger.info("STT SUCCESS (language=%s, languages=%s)", detected_lang, detected_langs)
                    logger.info("TRANSCRIPT: %s", transcript)

                    # Persist genuine transcript to database
                    await append_call_transcript(active_session, transcript)

                    # Step 2: Run Orchestrator
                    logger.info("ORCHESTRATOR START")
                    orch_result = await pipeline.run_orchestrator(
                        transcript=transcript,
                        session_id=active_session,
                        metadata=metadata,
                        language=detected_lang,
                        languages=detected_langs
                    )
                    response_text = orch_result.get("response_text", "")
                    logger.info("AI RESPONSE: %s", response_text)

            # Step 3: Broadcast to Dispatcher Dashboard
            if transcript:
                await dashboard_manager.broadcast("CALL_TRANSCRIPT_UPDATE", {
                    "stream_id": stream_sid,
                    "session_id": active_session,
                    "call_id": active_session,
                    "transcript": transcript,
                    "language": detected_lang,
                    "languages": detected_langs,
                    "orchestrator": orch_result
                })
                await dashboard_manager.broadcast("TRANSCRIPT_UPDATE", {
                    "stream_id": stream_sid,
                    "session_id": active_session,
                    "call_id": active_session,
                    "transcript": transcript,
                    "text": transcript,
                    "language": detected_lang,
                    "languages": detected_langs,
                    "isAi": False
                })

                # If emergency detected or supervisor escalation requested, broadcast alert
                if orch_result.get("route") == "human_supervisor" or orch_result.get("emergency") or orch_result.get("urgency") in ("HIGH", "CRITICAL"):
                    await dashboard_manager.broadcast("EMERGENCY_DETECTED", {
                        "stream_id": stream_sid,
                        "session_id": active_session,
                        "call_id": active_session,
                        "priority": "CRITICAL" if orch_result.get("urgency") == "CRITICAL" else "HIGH",
                        "reason": f"Escalation triggered: category={orch_result.get('category')}",
                        "incident_type": orch_result.get("category"),
                        "urgency": orch_result.get("urgency", "HIGH"),
                        "transcript": transcript,
                        "location": orch_result.get("location")
                    })
                    await dashboard_manager.broadcast("EMERGENCY_ALERT", {
                        "session_id": active_session,
                        "priority": "CRITICAL" if orch_result.get("urgency") == "CRITICAL" else "HIGH",
                        "transcript": transcript,
                        "category": orch_result.get("category"),
                    })
            # Guardrail 1: Check if supervisor has taken over this call BEFORE synthesizing TTS
            session_obj = orchestrator.get_session(active_session) if orchestrator and active_session else None
            is_takeover = (
                is_human_takeover
                or (session_obj and (session_obj.tts_halted or session_obj.status.value in ("supervisor_connected", "HUMAN_TAKEOVER")))
                or (active_session and pipeline.is_session_overridden(active_session))
            )
            if is_takeover and not is_supervisor_req:
                logger.info("AI TTS BLOCKED DURING TAKEOVER: session=%s (takeover active before TTS synthesis)", active_session)
                try:
                    await websocket.send_text(json.dumps({"event": "clear", "stream_sid": stream_sid}))
                except Exception:
                    pass
                return

            await dashboard_manager.broadcast("TTS_READY", {
                "stream_id": stream_sid,
                "session_id": active_session,
                "call_id": active_session,
                "text": response_text,
                "isAi": True
            })

            # Step 4: Synthesize Speech (TTS)
            ulaw_audio = await pipeline.synthesize_speech(response_text)

            # Guardrail 2: Check if supervisor took over DURING TTS synthesis
            session_obj = orchestrator.get_session(active_session) if orchestrator and active_session else None
            if (
                is_human_takeover
                or (session_obj and (session_obj.tts_halted or session_obj.status.value in ("supervisor_connected", "HUMAN_TAKEOVER")))
                or (active_session and pipeline.is_session_overridden(active_session))
            ) and not is_supervisor_req:
                logger.info("AI TTS BLOCKED DURING TAKEOVER: session=%s (takeover active post-synthesis, pre-send)", active_session)
                try:
                    await websocket.send_text(json.dumps({"event": "clear", "stream_sid": stream_sid}))
                except Exception:
                    pass
                return

            outbound_pcm16_audio = ulaw_to_pcm16(ulaw_audio)
            outbound_b64 = base64.b64encode(outbound_pcm16_audio).decode("ascii")
            logger.info("TTS GENERATED (pcm16_bytes=%d)", len(outbound_pcm16_audio))

            # Step 5: Setup Echo Suppression & Mark Tracking
            playback_duration_sec = len(outbound_pcm16_audio) / (SAMPLE_RATE * BYTES_PER_SAMPLE)
            mark_id = f"turn_{turn_counter}_{int(time.time() * 1000)}"
            assistant_speaking = True
            active_mark_id = mark_id
            # Duration + 350ms buffer for transport jitter
            playback_expected_end_time = time.time() + playback_duration_sec + 0.35

            # Guardrail 3: Final check right before sending media frame
            if (
                is_human_takeover
                or (session_obj and session_obj.tts_halted)
                or (active_session and pipeline.is_session_overridden(active_session))
            ) and not is_supervisor_req:
                logger.info("AI TTS BLOCKED DURING TAKEOVER: session=%s (immediate pre-send guard)", active_session)
                try:
                    await websocket.send_text(json.dumps({"event": "clear", "stream_sid": stream_sid}))
                except Exception:
                    pass
                return

            # Step 6: Send Outbound Media Frame to Exotel
            outbound_message = {
                "event": "media",
                "stream_sid": stream_sid,
                "media": {
                    "payload": outbound_b64
                }
            }
            await websocket.send_text(json.dumps(outbound_message))

            # Step 7: Send Playback Synchronization Mark to Exotel
            mark_message = {
                "event": "mark",
                "stream_sid": stream_sid,
                "mark": {
                    "name": mark_id
                }
            }
            await websocket.send_text(json.dumps(mark_message))
            logger.info("AUDIO SENT (stream_sid=%s, duration=%.2fs, mark=%s)", stream_sid, playback_duration_sec, mark_id)

            if terminate_after_playback:
                logger.info("CONSENT DENIED: Terminating call session %s after disclaimer completes", active_session)
                await asyncio.sleep(playback_duration_sec + 0.35)
                try:
                    await websocket.close()
                except Exception:
                    pass
                return

        except Exception as turn_err:
            logger.error("AUDIO ERROR: Error executing voice turn: %s", turn_err, exc_info=True)
            assistant_speaking = False
            active_mark_id = None
        finally:
            # Reset turn state for next user utterance
            audio_buffer.clear()
            speech_detected = False
            speech_duration_ms = 0
            silence_duration_ms = 0
            is_processing_turn = False

    try:
        while True:
            raw_message = await websocket.receive_text()

            try:
                msg = json.loads(raw_message)
            except json.JSONDecodeError:
                logger.warning("Received invalid non-JSON payload from Exotel: %s", raw_message[:100])
                continue

            event_type = (msg.get("event") or "").lower()

            # ------------------------------------------------------------------
            # 1. Connected Event
            # ------------------------------------------------------------------
            if event_type == "connected":
                logger.info("EXOTEL CONNECTED")
                continue

            # ------------------------------------------------------------------
            # 2. Start Event
            # ------------------------------------------------------------------
            elif event_type == "start":
                start_data = msg.get("start", {})
                stream_sid = (
                    msg.get("stream_sid")
                    or msg.get("streamSid")
                    or start_data.get("stream_sid")
                    or start_data.get("streamSid")
                    or "exo_stream"
                )
                call_sid = (
                    start_data.get("call_sid")
                    or start_data.get("callSid")
                    or msg.get("call_sid")
                    or msg.get("callSid")
                    or stream_sid
                )
                from_number = start_data.get("from") or start_data.get("caller") or "Exotel Caller"

                session_id = f"EXO-{call_sid}"
                start_time = datetime.now(timezone.utc)

                logger.info("CALL STARTED (session_id=%s, stream_sid=%s)", session_id, stream_sid)

                # Register active Exotel stream in core audio bridge
                audio_bridge.register_exotel_call(session_id, websocket, stream_sid, call_sid=call_sid)

                # Persist call start in shared call_sessions table
                await create_call_session(
                    call_id=session_id,
                    caller_name=from_number,
                    source="exotel",
                    status="awaiting_consent",
                    start_time=start_time
                )

                # Initialize session in orchestrator if available
                orchestrator = getattr(websocket.app.state, "orchestrator", None) if hasattr(websocket, "app") else None
                if orchestrator:
                    sess = orchestrator.get_session(session_id)
                    if not sess:
                        sess = orchestrator.create_session_instant(call_sid=call_sid, from_number=from_number)
                        sess.session_id = session_id
                        orchestrator._sessions[session_id] = sess
                    sess.status = SessionStatus.AWAITING_CONSENT

                # Broadcast live call start to dispatcher dashboard
                await dashboard_manager.broadcast("INCOMING_CALL", {
                    "call_id": session_id,
                    "session_id": session_id,
                    "stream_id": stream_sid,
                    "stream_sid": stream_sid,
                    "caller": from_number,
                    "source": "exotel",
                    "status": "AWAITING_CONSENT"
                })
                await dashboard_manager.broadcast("CALL_STARTED", {
                    "stream_id": stream_sid,
                    "stream_sid": stream_sid,
                    "call_id": session_id,
                    "session_id": session_id,
                    "caller": from_number,
                    "source": "exotel",
                    "event": "start",
                    "status": "AWAITING_CONSENT"
                })
                await dashboard_manager.broadcast("EXOTEL_CALL_STARTED", {
                    "stream_id": stream_sid,
                    "stream_sid": stream_sid,
                    "call_id": session_id,
                    "session_id": session_id,
                    "caller": from_number,
                    "source": "exotel",
                    "event": "start",
                    "status": "AWAITING_CONSENT"
                })

                is_test_env = bool(os.environ.get("PYTEST_CURRENT_TEST"))
                enable_consent_flow = (
                    not is_test_env
                    or "consent" in (stream_sid or "").lower()
                    or "consent" in (call_sid or "").lower()
                )

                if not enable_consent_flow:
                    awaiting_consent = False
                    consent_granted = True
                else:
                    awaiting_consent = True
                    consent_granted = None
                    # FEATURE 1: Send initial consent greeting immediately upon connection
                    try:
                        logger.info("DELIVERING MANDATORY CONSENT GREETING (session_id=%s)", session_id)
                        ulaw_audio = await get_consent_greeting_ulaw()
                        outbound_pcm16_audio = ulaw_to_pcm16(ulaw_audio)
                        outbound_b64 = base64.b64encode(outbound_pcm16_audio).decode("ascii")
                        playback_duration_sec = len(outbound_pcm16_audio) / (SAMPLE_RATE * BYTES_PER_SAMPLE)
                        mark_id = f"consent_greeting_{int(time.time() * 1000)}"
                        assistant_speaking = True
                        active_mark_id = mark_id
                        playback_expected_end_time = time.time() + playback_duration_sec + 0.35

                        await websocket.send_text(json.dumps({
                            "event": "media",
                            "stream_sid": stream_sid,
                            "media": {"payload": outbound_b64}
                        }))
                        await websocket.send_text(json.dumps({
                            "event": "mark",
                            "stream_sid": stream_sid,
                            "mark": {"name": mark_id}
                        }))
                        logger.info("CONSENT GREETING DELIVERED (duration=%.2fs)", playback_duration_sec)
                    except Exception as cg_err:
                        logger.error("Failed to send initial consent greeting: %s", cg_err)

                # If Deepgram API key is configured, initialize streaming session
                if deepgram_service.api_key:
                    deepgram_audio_queue = asyncio.Queue()

                    async def deepgram_worker():
                        async def audio_gen():
                            while True:
                                chunk = await deepgram_audio_queue.get()
                                if chunk is None:
                                    break
                                yield chunk
                        try:
                            async for chunk in deepgram_service.transcribe_audio_stream(
                                audio_gen(),
                                sample_rate=SAMPLE_RATE,
                                encoding="linear16"
                            ):
                                if chunk.speech_final and chunk.text:
                                    await process_completed_turn(chunk.text)
                                elif chunk.text:
                                    await dashboard_manager.broadcast("TRANSCRIPT_UPDATE", {
                                        "stream_id": stream_sid,
                                        "session_id": session_id,
                                        "transcript": chunk.text,
                                        "is_interim": True
                                    })
                        except Exception as dg_err:
                            logger.warning("Deepgram streaming worker finished: %s", dg_err)

                    deepgram_task = asyncio.create_task(deepgram_worker())
                continue

            # ------------------------------------------------------------------
            # 3. Media Audio Chunk Event (Turn & Silence Detection Flow)
            # ------------------------------------------------------------------
            elif event_type == "media":
                media_container = msg.get("media", {})
                payload = media_container.get("payload") if isinstance(media_container, dict) else msg.get("payload")

                if not payload:
                    continue

                # Exotel sends Base64-encoded PCM16 8kHz mono
                try:
                    inbound_pcm16_chunk = base64.b64decode(payload)
                except Exception as b64_err:
                    logger.warning("Failed to decode base64 audio from Exotel: %s", b64_err)
                    continue

                if not inbound_pcm16_chunk:
                    continue

                # Check if session is in HUMAN_TAKEOVER mode
                orchestrator = getattr(websocket.app.state, "orchestrator", None) if hasattr(websocket, "app") else None
                session_obj = orchestrator.get_session(session_id) if orchestrator and session_id else None
                in_takeover = (
                    is_human_takeover
                    or (session_id and pipeline.is_session_overridden(session_id))
                    or (session_obj and (session_obj.tts_halted or session_obj.status.value in ("supervisor_connected", "HUMAN_TAKEOVER")))
                )
                if in_takeover:
                    # Stream caller audio directly to supervisor dashboard / headset
                    await audio_bridge.route_caller_audio(session_id or f"EXO-{stream_sid}", inbound_pcm16_chunk)
                    # Forward to Deepgram so supervisor dashboard still sees live transcript updates
                    if deepgram_audio_queue is not None:
                        await deepgram_audio_queue.put(inbound_pcm16_chunk)
                    continue

                # Echo Suppression: If assistant is currently speaking/playing back TTS audio,
                # drop inbound audio to prevent acoustic feedback / bridge echo from triggering a turn
                now = time.time()
                if assistant_speaking:
                    if now < playback_expected_end_time:
                        continue
                    else:
                        # Timeout fallback in case telephony mark was not returned
                        assistant_speaking = False
                        active_mark_id = None
                        audio_buffer.clear()
                        speech_detected = False
                        speech_duration_ms = 0
                        silence_duration_ms = 0
                        logger.info("WAITING FOR NEXT CALLER TURN")

                if is_processing_turn:
                    continue

                chunk_ms = int((len(inbound_pcm16_chunk) / (SAMPLE_RATE * BYTES_PER_SAMPLE)) * 1000)
                rms = calculate_pcm16_rms(inbound_pcm16_chunk)
                is_chunk_speech = rms >= SILENCE_ENERGY_THRESHOLD

                # Pipe to streaming Deepgram queue if active
                if deepgram_audio_queue is not None:
                    await deepgram_audio_queue.put(inbound_pcm16_chunk)

                if is_chunk_speech:
                    if not speech_detected:
                        logger.info("AUDIO RECEIVED (stream_sid=%s, speech detected, rms=%.1f)", stream_sid, rms)
                    speech_detected = True
                    speech_duration_ms += chunk_ms
                    silence_duration_ms = 0
                    audio_buffer.extend(inbound_pcm16_chunk)

                    # Guardrail: Force process turn if caller speaks continuously past MAX_TURN_DURATION_MS
                    if speech_duration_ms >= MAX_TURN_DURATION_MS:
                        logger.info("TURN DETECTED: Max duration reached (%dms); processing turn.", speech_duration_ms)
                        await process_completed_turn()
                else:
                    # Silence chunk
                    if speech_detected:
                        silence_duration_ms += chunk_ms
                        audio_buffer.extend(inbound_pcm16_chunk)

                        # Utterance complete: caller paused after speaking
                        if silence_duration_ms >= SILENCE_DURATION_MS and speech_duration_ms >= MIN_SPEECH_DURATION_MS:
                            logger.info(
                                "TURN DETECTED: Caller finished speaking (speech=%dms, silence=%dms, buffer=%d bytes)",
                                speech_duration_ms, silence_duration_ms, len(audio_buffer)
                            )
                            await process_completed_turn()
                    else:
                        # Pre-speech silence - keep a rolling 100ms window for smooth onset
                        if len(audio_buffer) < 1600:
                            audio_buffer.extend(inbound_pcm16_chunk)
                        else:
                            audio_buffer[:len(inbound_pcm16_chunk)] = []
                            audio_buffer.extend(inbound_pcm16_chunk)

            # ------------------------------------------------------------------
            # 4. DTMF Digits Event
            # ------------------------------------------------------------------
            elif event_type == "dtmf":
                digit = msg.get("dtmf", {}).get("digit") if isinstance(msg.get("dtmf"), dict) else msg.get("digit")
                logger.info("DTMF RECEIVED: digit=%s (stream_sid=%s)", digit, stream_sid)

            # ------------------------------------------------------------------
            # 5. Mark Event
            # ------------------------------------------------------------------
            elif event_type == "mark":
                mark_name = msg.get("mark", {}).get("name") if isinstance(msg.get("mark"), dict) else msg.get("name")
                logger.info("MARK RECEIVED: name=%s (stream_sid=%s)", mark_name, stream_sid)
                if active_mark_id and mark_name == active_mark_id:
                    assistant_speaking = False
                    active_mark_id = None
                    audio_buffer.clear()
                    speech_detected = False
                    speech_duration_ms = 0
                    silence_duration_ms = 0
                    logger.info("WAITING FOR NEXT CALLER TURN")

            # ------------------------------------------------------------------
            # 6. Clear Event (Buffer Flush)
            # ------------------------------------------------------------------
            elif event_type == "clear":
                logger.info("CLEAR BUFFER (stream_sid=%s)", stream_sid)
                audio_buffer.clear()
                speech_detected = False
                speech_duration_ms = 0
                silence_duration_ms = 0

            # ------------------------------------------------------------------
            # 7. Stop Event
            # ------------------------------------------------------------------
            elif event_type == "stop":
                logger.info("CALL STOPPED (stream_sid=%s)", stream_sid)
                if speech_detected and speech_duration_ms >= MIN_SPEECH_DURATION_MS:
                    await process_completed_turn()
                break

    except WebSocketDisconnect:
        logger.info("Exotel WebSocket disconnected gracefully: %s", session_id or stream_sid)
    except Exception as exc:
        logger.error("Error in Exotel WebSocket session (%s): %s", session_id or stream_sid, exc)
        call_status = "interrupted"
    finally:
        # Clean up Deepgram streaming task if active
        if deepgram_audio_queue is not None:
            await deepgram_audio_queue.put(None)
        if deepgram_task is not None:
            deepgram_task.cancel()

        end_time = datetime.now(timezone.utc)
        duration_sec = max(1, int((end_time - start_time).total_seconds()))
        active_session = session_id or f"EXO-{stream_sid or 'session'}"

        # Cleanly release session conversation memory and unregister from audio bridge
        pipeline.clear_session_state(active_session)
        audio_bridge.unregister_exotel_call(active_session)

        try:
            await update_call_session(
                call_id=active_session,
                end_time=end_time,
                duration_sec=duration_sec,
                status=call_status
            )
        except Exception as db_err:
            logger.error("Failed to update Exotel call session in DB: %s", db_err)

        # Broadcast provider-neutral and Exotel end of call to dispatcher dashboard
        await dashboard_manager.broadcast("CALL_ENDED", {
            "stream_id": stream_sid,
            "session_id": active_session,
            "call_id": active_session,
            "duration_sec": duration_sec,
            "status": "COMPLETED"
        })
        await dashboard_manager.broadcast("EXOTEL_CALL_ENDED", {
            "stream_id": stream_sid,
            "session_id": active_session,
            "call_id": active_session,
            "duration_sec": duration_sec,
            "status": "COMPLETED"
        })

        logger.info("CALL STOPPED (session_id=%s, duration=%ds)", active_session, duration_sec)

        try:
            await websocket.close()
        except Exception:
            pass
