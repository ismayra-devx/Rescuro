import json
import logging
from typing import Any, AsyncGenerator, Callable, Dict, Optional, Awaitable
import websockets
import httpx
from pydantic import BaseModel
from config import settings

logger = logging.getLogger("echosphere.deepgram")

DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"
DEEPGRAM_REST_URL = "https://api.deepgram.com/v1/listen"

class TranscriptChunk(BaseModel):
    text: str
    confidence: float
    is_final: bool
    language: str
    speech_final: bool
    speaker: str = "caller"


class DeepgramService:
    """
    Streaming multilingual (Hindi/English code-switching) transcription service
    powered by Deepgram Nova-2 via WebSocket and REST.
    """
    def __init__(self):
        self.api_key = settings.DEEPGRAM_API_KEY.strip()

    def _get_query_params(self, sample_rate: int = 8000, encoding: str = "mulaw") -> str:
        """
        Builds query parameters for Deepgram Nova-2 multilingual streaming.
        Uses multi-language detection for Hindi and English code-switching.
        """
        params = [
            "model=nova-2",
            "smart_format=true",
            "interim_results=true",
            "endpointing=350",
            f"sample_rate={sample_rate}",
            f"encoding={encoding}",
            "language=hi",
            "extra=code_switch:true",
            "detect_language=true",
        ]
        return "&".join(params)

    async def transcribe_audio_stream(
        self,
        audio_chunks: AsyncGenerator[bytes, None],
        on_chunk_callback: Optional[Callable[[TranscriptChunk], Awaitable[None]]] = None,
        sample_rate: int = 8000,
        encoding: str = "mulaw"
    ) -> AsyncGenerator[TranscriptChunk, None]:
        """
        Connects directly to Deepgram Nova-2 streaming WebSocket, pipes audio bytes,
        and yields/invokes callbacks with transcript chunks containing per-turn confidence scores.
        
        Args:
            audio_chunks: Inbound stream of raw audio byte packets (e.g. from Twilio or Agora)
            on_chunk_callback: Async callback invoked whenever a valid transcript turn arrives
            sample_rate: Audio sampling frequency (Twilio mulaw is 8000Hz)
            encoding: Audio compression codec ('mulaw', 'linear16', etc.)
        """
        if not self.api_key or self.api_key.startswith("your_"):
            logger.warning("Deepgram API key not configured; mock streaming generator will be used.")
            yield TranscriptChunk(
                text="मेरा नाम राहुल है, मुझे इमरजेंसी हेल्प चाहिए।",
                confidence=0.92,
                is_final=True,
                language="hi-en",
                speech_final=True
            )
            return

        query_str = self._get_query_params(sample_rate=sample_rate, encoding=encoding)
        ws_endpoint = f"{DEEPGRAM_WS_URL}?{query_str}"
        headers = {"Authorization": f"Token {self.api_key}"}

        try:
            async with websockets.connect(ws_endpoint, extra_headers=headers) as ws:
                logger.info("Connected to Deepgram Nova-2 streaming WebSocket.")

                # Coroutine to continuously send raw audio chunks
                async def sender():
                    try:
                        async for chunk in audio_chunks:
                            if chunk:
                                await ws.send(chunk)
                        # Send close stream frame to Deepgram
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
                            detected_lang = best_alt.get("languages", ["hi-en"])[0] if best_alt.get("languages") else "hi-en"

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

        except Exception as exc:
            logger.error("Deepgram streaming WebSocket exception: %s", exc)

    async def transcribe_prerecorded(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/wav"
    ) -> Dict[str, Any]:
        """
        One-shot synchronous/REST transcription fallback for recorded audio buffers.
        """
        if not self.api_key or self.api_key.startswith("your_"):
            return {
                "transcript": "नमस्ते, मुझे मदद चाहिए",
                "confidence": 0.95,
                "language": "hi"
            }

        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": mime_type
        }
        params = {
            "model": "nova-2",
            "smart_format": "true",
            "detect_language": "true"
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    DEEPGRAM_REST_URL,
                    headers=headers,
                    params=params,
                    content=audio_bytes
                )
                if response.status_code == 200:
                    data = response.json()
                    channels = data.get("results", {}).get("channels", [])
                    if channels and channels[0].get("alternatives"):
                        alt = channels[0]["alternatives"][0]
                        return {
                            "transcript": alt.get("transcript", ""),
                            "confidence": alt.get("confidence", 0.0),
                            "language": alt.get("languages", ["hi-en"])[0] if alt.get("languages") else "hi-en"
                        }
                logger.error("Deepgram REST returned status %s: %s", response.status_code, response.text)
                return {"transcript": "", "confidence": 0.0, "language": "unknown"}
        except Exception as exc:
            logger.error("Deepgram REST error: %s", exc)
            return {"transcript": "", "confidence": 0.0, "language": "error"}


# Singleton service instance
deepgram_service = DeepgramService()
