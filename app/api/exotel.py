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
from app.services import pipeline
from app.services.deepgram_service import deepgram_service
from app.services.tts_service import pcm16_to_ulaw, ulaw_to_pcm16

logger = logging.getLogger("rescuro.exotel")
router = APIRouter(prefix="/exotel", tags=["Exotel Telephony"])

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

    # Deepgram streaming session management
    deepgram_audio_queue: Optional[asyncio.Queue] = None
    deepgram_task: Optional[asyncio.Task] = None

    async def process_completed_turn(transcript_text: Optional[str] = None):
        """Execute exactly ONE full turn: STT -> Orchestrator -> TTS -> Outbound Media."""
        nonlocal speech_detected, speech_duration_ms, silence_duration_ms, is_processing_turn
        nonlocal assistant_speaking, active_mark_id, playback_expected_end_time, turn_counter

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
            await dashboard_manager.broadcast("TTS_READY", {
                "stream_id": stream_sid,
                "session_id": active_session,
                "call_id": active_session,
                "text": response_text,
                "isAi": True
            })

            # Step 4: Synthesize Speech (TTS)
            ulaw_audio = await pipeline.synthesize_speech(response_text)
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
                stream_sid = msg.get("stream_sid") or start_data.get("stream_sid") or "exo_stream"
                call_sid = start_data.get("call_sid") or start_data.get("callSid") or msg.get("call_sid") or stream_sid
                from_number = start_data.get("from") or start_data.get("caller") or "Exotel Caller"

                session_id = f"EXO-{call_sid}"
                start_time = datetime.now(timezone.utc)

                logger.info("CALL STARTED (session_id=%s, stream_sid=%s)", session_id, stream_sid)

                # Persist call start in shared call_sessions table
                await create_call_session(
                    call_id=session_id,
                    caller_name=from_number,
                    source="exotel",
                    status="active",
                    start_time=start_time
                )

                # Broadcast live call start to dispatcher dashboard
                await dashboard_manager.broadcast("INCOMING_CALL", {
                    "call_id": session_id,
                    "session_id": session_id,
                    "caller": from_number,
                    "source": "exotel",
                    "status": "ACTIVE"
                })
                await dashboard_manager.broadcast("CALL_STARTED", {
                    "stream_id": stream_sid,
                    "call_id": session_id,
                    "caller": from_number,
                    "source": "exotel",
                    "event": "start"
                })
                await dashboard_manager.broadcast("EXOTEL_CALL_STARTED", {
                    "stream_id": stream_sid,
                    "call_id": session_id,
                    "caller": from_number,
                    "source": "exotel",
                    "event": "start"
                })

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

        # Cleanly release session conversation memory
        pipeline.clear_session_state(active_session)

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
