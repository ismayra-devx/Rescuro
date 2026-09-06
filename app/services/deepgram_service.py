"""Deepgram Nova-2 STT Service for RESCURO.

Provides:
1. Real-time streaming WebSocket transcription with endpointing and speech_final turn detection.
2. Pre-recorded / buffer REST transcription fallback.
"""

import json
import logging
import io
import wave
import inspect
from typing import Any, AsyncGenerator, Callable, Dict, Optional, Awaitable
import websockets
import httpx
from pydantic import BaseModel

try:
    from app.config import settings
except ImportError:
    from config import settings

logger = logging.getLogger("rescuro.deepgram")

DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"
DEEPGRAM_REST_URL = "https://api.deepgram.com/v1/listen"


def _get_ws_connect_kwargs(headers: dict) -> dict:
    """Detect whether installed websockets expects additional_headers (v14+) or extra_headers (v12-13)."""
    sig = inspect.signature(websockets.connect)
    if "additional_headers" in sig.parameters:
        return {"additional_headers": headers}
    return {"extra_headers": headers}


def pcm16_to_wav_bytes(pcm_data: bytes, sample_rate: int = 8000, channels: int = 1) -> bytes:
    """Wraps raw signed 16-bit little-endian linear PCM audio bytes in a standard RIFF/WAV container."""
    if not pcm_data:
        return b""
    if pcm_data.startswith(b"RIFF"):
        return pcm_data
    with io.BytesIO() as wav_io:
        with wave.open(wav_io, "wb") as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_data)
        return wav_io.getvalue()


class TranscriptChunk(BaseModel):
    text: str
    confidence: float
    is_final: bool
    language: str
    speech_final: bool
    speaker: str = "caller"


EMERGENCY_KEYWORDS: Dict[str, int] = {
    "ambulance": 3,
    "emergency": 3,
    "accident": 2,
    "injured": 2,
    "injury": 2,
    "fire": 2,
    "police": 2,
    "dispatch": 2,
    "medical": 2,
    "hospital": 2,
    "rescue": 2,
    "unconscious": 2,
    "bleeding": 2,
    "collision": 2,
    "help": 2,
}


class DeepgramService:
    """
    Streaming transcription service powered by Deepgram Nova-3 (with Nova-2 fallback)
    via WebSocket and REST.
    Optimized for Indian English (en-IN), linear16 PCM, domain emergency keyword boosting,
    endpointing (300ms), and utterance_end_ms (1000ms).
    """

    def __init__(self):
        self._explicit_api_key: Optional[str] = None

    @property
    def api_key(self) -> str:
        """Dynamically fetch API key from settings or explicit override."""
        if self._explicit_api_key:
            return self._explicit_api_key.strip()
        key = getattr(settings, "DEEPGRAM_API_KEY", "") or ""
        return key.strip()

    @api_key.setter
    def api_key(self, val: str):
        self._explicit_api_key = val

    def _get_query_params(
        self,
        sample_rate: int = 8000,
        encoding: str = "linear16",
        language: Optional[str] = None,
        model: Optional[str] = None,
        endpointing: int = 300,
        utterance_end_ms: int = 1000,
    ) -> str:
        """
        Builds query parameters for Deepgram streaming WebSocket.
        Applies nova-3 tier (or fallback), endpointing=300ms, utterance_end_ms=1000ms,
        en-IN language, punctuation, smart formatting, and emergency keyword boosting.
        """
        chosen_model = model or getattr(settings, "DEEPGRAM_MODEL", "nova-3")
        params = [
            f"model={chosen_model}",
            "smart_format=true",
            "punctuate=true",
            "interim_results=true",
            f"endpointing={endpointing}",
            f"utterance_end_ms={utterance_end_ms}",
            f"sample_rate={sample_rate}",
            f"encoding={encoding}",
        ]
        lang = language or getattr(settings, "DEEPGRAM_LANGUAGE", "en-IN")
        if lang:
            params.append(f"language={lang}")
            if lang in ("hi", "en-IN"):
                params.append("extra=code_switch:true")
        else:
            params.append("language=en-IN")

        # Emergency dispatch keyword boosting
        for kw, weight in EMERGENCY_KEYWORDS.items():
            params.append(f"keywords={kw}:{weight}")

        return "&".join(params)

    async def transcribe_audio_stream(
        self,
        audio_chunks: AsyncGenerator[bytes, None],
        on_chunk_callback: Optional[Callable[[TranscriptChunk], Awaitable[None]]] = None,
        sample_rate: int = 8000,
        encoding: str = "linear16",
        language: Optional[str] = None
    ) -> AsyncGenerator[TranscriptChunk, None]:
        """
        Connects directly to Deepgram streaming WebSocket, pipes audio bytes,
        and yields transcript chunks with per-turn speech_final markers.
        Attempts nova-3 first, falling back to nova-2 if nova-3 is unavailable.
        """
        key = self.api_key
        target_lang = language or getattr(settings, "DEEPGRAM_LANGUAGE", "en-IN")

        if not key or key.startswith("your_"):
            logger.debug("Deepgram API key not configured; STT streaming inactive.")
            return

        model_tier = getattr(settings, "DEEPGRAM_MODEL", "nova-3")
        query_str = self._get_query_params(
            sample_rate=sample_rate,
            encoding=encoding,
            language=target_lang,
            model=model_tier
        )
        ws_endpoint = f"{DEEPGRAM_WS_URL}?{query_str}"
        headers = {"Authorization": f"Token {key}"}

        async def _run_ws(endpoint: str, active_model: str):
            connect_kwargs = _get_ws_connect_kwargs(headers)
            async with websockets.connect(endpoint, **connect_kwargs) as ws:
                logger.info(
                    "DEEPGRAM STREAM CONNECTED (model=%s, lang=%s, encoding=%s, rate=%d).",
                    active_model, target_lang, encoding, sample_rate
                )

                async def sender():
                    try:
                        async for chunk in audio_chunks:
                            if chunk:
                                await ws.send(chunk)
                        await ws.send(json.dumps({"type": "CloseStream"}))
                    except Exception as exc:
                        logger.error("Error sending audio to Deepgram: %s", exc)

                import asyncio
                send_task = asyncio.create_task(sender())

                try:
                    async for message in ws:
                        if isinstance(message, str):
                            data = json.loads(message)
                            channel = data.get("channel", {})
                            alternatives = channel.get("alternatives", [])
                            if not alternatives:
                                continue

                            best_alt = alternatives[0]
                            text = best_alt.get("transcript", "").strip()
                            if not text:
                                continue

                            confidence = float(best_alt.get("confidence", 0.85))
                            is_final = bool(data.get("is_final", False))
                            speech_final = bool(data.get("speech_final", False))
                            detected_lang = best_alt.get("languages", [target_lang])[0] if best_alt.get("languages") else target_lang

                            chunk_obj = TranscriptChunk(
                                text=text,
                                confidence=round(confidence, 3),
                                is_final=is_final,
                                language=detected_lang,
                                speech_final=speech_final,
                                speaker="caller"
                            )

                            if on_chunk_callback:
                                await on_chunk_callback(chunk_obj)

                            yield chunk_obj
                finally:
                    send_task.cancel()

        try:
            async for chunk in _run_ws(ws_endpoint, model_tier):
                yield chunk
        except websockets.exceptions.InvalidStatusCode as ws_err:
            if ws_err.status_code in (400, 404) and model_tier != "nova-2":
                logger.warning(
                    "Deepgram model '%s' failed with status %d; retrying fallback to 'nova-2'.",
                    model_tier, ws_err.status_code
                )
                fallback_query = self._get_query_params(
                    sample_rate=sample_rate,
                    encoding=encoding,
                    language=target_lang,
                    model="nova-2"
                )
                fallback_endpoint = f"{DEEPGRAM_WS_URL}?{fallback_query}"
                try:
                    async for chunk in _run_ws(fallback_endpoint, "nova-2"):
                        yield chunk
                except Exception as fallback_exc:
                    logger.error("DEEPGRAM STREAM ERROR: Deepgram fallback to nova-2 failed: %s", fallback_exc)
            else:
                logger.error("DEEPGRAM STREAM ERROR: Deepgram WebSocket handshake failed (%s): %s", ws_err.status_code, ws_err)
        except Exception as exc:
            logger.error("DEEPGRAM STREAM ERROR: %s", exc)

    async def transcribe_prerecorded(
        self,
        audio_bytes: bytes,
        mime_type: Optional[str] = None,
        sample_rate: int = 8000,
        encoding: str = "linear16",
        channels: int = 1,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        One-shot REST transcription fallback for recorded audio buffers.
        Wraps raw PCM16 audio in standard WAV format to guarantee reliable Deepgram parsing.
        Never manufactures a fake transcript on failure.
        """
        key = self.api_key
        target_lang = language or getattr(settings, "DEEPGRAM_LANGUAGE", "en-IN")

        if not key or key.startswith("your_"):
            logger.debug("Deepgram API key not configured. Returning empty transcript (no fake fallback).")
            return {
                "transcript": "",
                "confidence": 0.0,
                "language": target_lang
            }

        if not audio_bytes:
            return {"transcript": "", "confidence": 0.0, "language": target_lang}

        # Convert raw PCM16 into standard WAV to ensure 100% reliable REST decoding by Deepgram
        is_mulaw = mime_type and "mulaw" in mime_type.lower()
        if is_mulaw:
            effective_mime = f"audio/x-mulaw;rate={sample_rate}"
            payload_bytes = audio_bytes
        elif audio_bytes.startswith(b"RIFF") or (mime_type and "wav" in mime_type.lower()):
            effective_mime = "audio/wav"
            payload_bytes = audio_bytes
        else:
            # Raw linear PCM -> package into valid standard WAV container
            effective_mime = "audio/wav"
            payload_bytes = pcm16_to_wav_bytes(audio_bytes, sample_rate=sample_rate, channels=channels)

        headers = {
            "Authorization": f"Token {key}",
            "Content-Type": effective_mime
        }
        model_tier = getattr(settings, "DEEPGRAM_MODEL", "nova-3")
        params = [
            ("model", model_tier),
            ("smart_format", "true"),
            ("punctuate", "true"),
            ("language", target_lang),
            ("sample_rate", str(sample_rate)),
            ("channels", str(channels)),
        ]
        if is_mulaw:
            params.append(("encoding", "mulaw"))
        elif not payload_bytes.startswith(b"RIFF"):
            params.append(("encoding", "linear16"))

        if target_lang in ("hi", "en-IN"):
            params.append(("extra", "code_switch:true"))

        for kw, weight in EMERGENCY_KEYWORDS.items():
            params.append(("keywords", f"{kw}:{weight}"))

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    DEEPGRAM_REST_URL,
                    headers=headers,
                    params=params,
                    content=payload_bytes
                )
                # Fallback to nova-2 if nova-3 is unavailable on plan
                if response.status_code in (400, 404) and model_tier != "nova-2":
                    logger.warning(
                        "Deepgram REST model '%s' failed (HTTP %d). Falling back to 'nova-2'.",
                        model_tier, response.status_code
                    )
                    fallback_params = [p if p[0] != "model" else ("model", "nova-2") for p in params]
                    response = await client.post(
                        DEEPGRAM_REST_URL,
                        headers=headers,
                        params=fallback_params,
                        content=payload_bytes
                    )

                if response.status_code == 200:
                    data = response.json()
                    results_channels = data.get("results", {}).get("channels", [])
                    if results_channels and results_channels[0].get("alternatives"):
                        alt = results_channels[0]["alternatives"][0]
                        transcript_text = alt.get("transcript", "").strip()
                        return {
                            "transcript": transcript_text,
                            "confidence": alt.get("confidence", 0.0),
                            "language": alt.get("languages", [target_lang])[0] if alt.get("languages") else target_lang
                        }
                logger.error("Deepgram REST returned status %s: %s", response.status_code, response.text)
                return {"transcript": "", "confidence": 0.0, "language": "unknown"}
        except Exception as exc:
            logger.error("Deepgram REST error: %s", exc)
            return {"transcript": "", "confidence": 0.0, "language": "error"}


# Singleton service instance
deepgram_service = DeepgramService()
