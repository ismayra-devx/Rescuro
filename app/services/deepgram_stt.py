"""Deepgram Streaming STT Adapter.

Async-first WebSocket adapter that streams audio to Deepgram's real-time
transcription API and emits structured transcript results. Designed to
never block the event loop.

Architecture
────────────
                                ┌──────────────────┐
  audio bytes ──► asyncio.Queue ──► _sender_loop() ──► Deepgram WS
                                └──────────────────┘
                                ┌──────────────────┐
  Deepgram WS ──► _receiver_loop() ──► callback(TranscriptResult) ──► orchestrator
                                └──────────────────┘

The adapter does NOT touch the LLM pipeline or triage layer. It only
produces TranscriptResult dataclass instances and fires async callbacks.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional

import websockets
import websockets.asyncio.client

from app.config import settings

logger = logging.getLogger("deepgram-stt")


# ──────────────────────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class TranscriptResult:
    """Immutable result emitted for every Deepgram transcript event."""

    transcript: str
    confidence: float           # STT confidence 0.0–1.0
    is_final: bool              # True when Deepgram marks the utterance final
    session_id: str
    speech_final: bool = False  # True on speech_final (end-of-turn)
    words: List[Dict[str, Any]] = field(default_factory=list)
    start: float = 0.0
    duration: float = 0.0
    channel_index: int = 0


class AdapterState(str, Enum):
    """Connection lifecycle states."""

    IDLE = "IDLE"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    RECONNECTING = "RECONNECTING"
    CLOSED = "CLOSED"
    ERROR = "ERROR"


# ──────────────────────────────────────────────────────────────────────
# Deepgram Streaming STT Adapter
# ──────────────────────────────────────────────────────────────────────

# Type alias for transcript callbacks
TranscriptCallback = Callable[[TranscriptResult], Awaitable[None]]


class DeepgramSTTAdapter:
    """Async Deepgram streaming STT adapter.

    Usage
    ─────
        adapter = DeepgramSTTAdapter(session_id="...", api_key="...")
        adapter.on_transcript(my_callback)
        await adapter.start()
        await adapter.send_audio(chunk)   # non-blocking
        ...
        await adapter.stop()

    Parameters
    ──────────
    session_id : str
        Unique identifier for this streaming session.
    api_key : str | None
        Deepgram API key. Falls back to ``settings.DEEPGRAM_API_KEY``.
    model : str
        Deepgram model name (default ``nova-3``).
    language : str
        BCP-47 language tag (default ``en``).
    sample_rate : int
        Audio sample rate in Hz (default 16000).
    encoding : str
        Audio encoding (default ``linear16``).
    channels : int
        Number of audio channels (default 1).
    interim_results : bool
        Whether to emit partial/interim results (default True).
    utterance_end_ms : int
        Milliseconds of silence before Deepgram emits utterance_end (default 1000).
    vad_events : bool
        Whether to receive VAD (Voice Activity Detection) events (default True).
    smart_format : bool
        Enable Deepgram's smart formatting (default True).
    max_reconnect_attempts : int
        Maximum consecutive reconnection attempts (default 5).
    reconnect_base_delay : float
        Base delay in seconds for exponential backoff (default 1.0).
    """

    DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"

    def __init__(
        self,
        session_id: str,
        api_key: Optional[str] = None,
        *,
        model: str = "nova-3",
        language: str = "en",
        sample_rate: int = 16_000,
        encoding: str = "linear16",
        channels: int = 1,
        interim_results: bool = True,
        utterance_end_ms: int = 1_000,
        vad_events: bool = True,
        smart_format: bool = True,
        max_reconnect_attempts: int = 5,
        reconnect_base_delay: float = 1.0,
    ) -> None:
        self.session_id = session_id
        self._api_key = api_key or settings.DEEPGRAM_API_KEY or ""

        # Deepgram streaming options
        self._options: Dict[str, Any] = {
            "model": model,
            "language": language,
            "sample_rate": str(sample_rate),
            "encoding": encoding,
            "channels": str(channels),
            "interim_results": str(interim_results).lower(),
            "utterance_end_ms": str(utterance_end_ms),
            "vad_events": str(vad_events).lower(),
            "smart_format": str(smart_format).lower(),
            "punctuate": "true",
        }

        # Reconnection policy
        self._max_reconnect_attempts = max_reconnect_attempts
        self._reconnect_base_delay = reconnect_base_delay
        self._reconnect_count = 0

        # Runtime state
        self._state = AdapterState.IDLE
        self._ws: Optional[websockets.asyncio.client.ClientConnection] = None
        self._audio_queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue()
        self._callbacks: List[TranscriptCallback] = []
        self._sender_task: Optional[asyncio.Task] = None
        self._receiver_task: Optional[asyncio.Task] = None
        self._keepalive_task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()

        # Metrics
        self._bytes_sent = 0
        self._transcripts_received = 0
        self._connect_time: Optional[float] = None

    # ────────────────── Public API ──────────────────

    @property
    def state(self) -> AdapterState:
        """Current adapter lifecycle state."""
        return self._state

    @property
    def metrics(self) -> Dict[str, Any]:
        """Runtime metrics snapshot."""
        return {
            "session_id": self.session_id,
            "state": self._state.value,
            "bytes_sent": self._bytes_sent,
            "transcripts_received": self._transcripts_received,
            "reconnect_count": self._reconnect_count,
            "uptime_seconds": (
                round(time.monotonic() - self._connect_time, 2)
                if self._connect_time
                else 0.0
            ),
        }

    def on_transcript(self, callback: TranscriptCallback) -> None:
        """Register an async callback invoked for each transcript result."""
        self._callbacks.append(callback)
        logger.debug(
            "Registered transcript callback [session=%s total=%d]",
            self.session_id,
            len(self._callbacks),
        )

    async def start(self) -> None:
        """Open the Deepgram WebSocket and start sender/receiver loops."""
        if self._state in (AdapterState.CONNECTED, AdapterState.CONNECTING):
            logger.warning(
                "Adapter already %s [session=%s]", self._state.value, self.session_id
            )
            return

        self._stop_event.clear()
        await self._connect()

    async def send_audio(self, chunk: bytes) -> None:
        """Enqueue audio bytes for async transmission. Never blocks the loop."""
        if self._state not in (AdapterState.CONNECTED, AdapterState.RECONNECTING):
            logger.warning(
                "Audio discarded — adapter state=%s [session=%s]",
                self._state.value,
                self.session_id,
            )
            return
        await self._audio_queue.put(chunk)

    async def stop(self) -> None:
        """Gracefully close the Deepgram connection and cancel background tasks."""
        logger.info("Stopping adapter [session=%s]", self.session_id)
        self._stop_event.set()

        # Signal sender to stop
        await self._audio_queue.put(None)

        # Send CloseStream message if connection is open
        if self._ws and self._state == AdapterState.CONNECTED:
            try:
                await self._ws.send(json.dumps({"type": "CloseStream"}))
                logger.info(
                    "Sent CloseStream to Deepgram [session=%s]", self.session_id
                )
            except Exception as exc:
                logger.debug("CloseStream send failed: %s", exc)

        # Cancel background tasks
        for task in (self._sender_task, self._receiver_task, self._keepalive_task):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        # Close the WebSocket
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

        self._state = AdapterState.CLOSED
        logger.info(
            "Adapter stopped [session=%s metrics=%s]",
            self.session_id,
            self.metrics,
        )

    # ────────────────── Connection Management ──────────────────

    def _build_ws_url(self) -> str:
        """Construct Deepgram WebSocket URL with query parameters."""
        params = "&".join(f"{k}={v}" for k, v in self._options.items())
        return f"{self.DEEPGRAM_WS_URL}?{params}"

    async def _connect(self) -> None:
        """Establish WebSocket connection to Deepgram."""
        self._state = AdapterState.CONNECTING
        url = self._build_ws_url()

        logger.info(
            "Connecting to Deepgram [session=%s url=%s]",
            self.session_id,
            url.split("?")[0] + "?...",
        )

        try:
            self._ws = await websockets.asyncio.client.connect(
                url,
                additional_headers={
                    "Authorization": f"Token {self._api_key}",
                },
                ping_interval=20,
                ping_timeout=10,
                close_timeout=5,
            )
            self._state = AdapterState.CONNECTED
            self._connect_time = time.monotonic()
            self._reconnect_count = 0

            logger.info(
                "✓ Deepgram connected [session=%s]", self.session_id
            )

            # Launch background loops
            self._sender_task = asyncio.create_task(
                self._sender_loop(), name=f"dg-sender-{self.session_id[:8]}"
            )
            self._receiver_task = asyncio.create_task(
                self._receiver_loop(), name=f"dg-receiver-{self.session_id[:8]}"
            )
            self._keepalive_task = asyncio.create_task(
                self._keepalive_loop(), name=f"dg-keepalive-{self.session_id[:8]}"
            )

        except Exception as exc:
            self._state = AdapterState.ERROR
            logger.error(
                "✗ Deepgram connection failed [session=%s]: %s",
                self.session_id,
                exc,
            )
            await self._maybe_reconnect()

    async def _maybe_reconnect(self) -> None:
        """Attempt reconnection with exponential backoff."""
        if self._stop_event.is_set():
            logger.info(
                "Reconnect skipped — stop requested [session=%s]", self.session_id
            )
            return

        if self._reconnect_count >= self._max_reconnect_attempts:
            logger.error(
                "✗ Max reconnect attempts (%d) reached [session=%s]",
                self._max_reconnect_attempts,
                self.session_id,
            )
            self._state = AdapterState.ERROR
            return

        self._reconnect_count += 1
        delay = self._reconnect_base_delay * (2 ** (self._reconnect_count - 1))
        self._state = AdapterState.RECONNECTING

        logger.warning(
            "Reconnecting in %.1fs (attempt %d/%d) [session=%s]",
            delay,
            self._reconnect_count,
            self._max_reconnect_attempts,
            self.session_id,
        )

        await asyncio.sleep(delay)
        await self._connect()

    # ────────────────── Background Loops ──────────────────

    async def _sender_loop(self) -> None:
        """Dequeue audio chunks and send them over the WebSocket."""
        logger.debug("Sender loop started [session=%s]", self.session_id)
        try:
            while not self._stop_event.is_set():
                chunk = await self._audio_queue.get()
                if chunk is None:
                    break  # Poison pill
                if self._ws and self._state == AdapterState.CONNECTED:
                    try:
                        await self._ws.send(chunk)
                        self._bytes_sent += len(chunk)
                    except websockets.ConnectionClosed:
                        logger.warning(
                            "Sender: connection closed mid-send [session=%s]",
                            self.session_id,
                        )
                        break
                    except Exception as exc:
                        logger.error(
                            "Sender error [session=%s]: %s", self.session_id, exc
                        )
        except asyncio.CancelledError:
            pass
        logger.debug("Sender loop exited [session=%s]", self.session_id)

    async def _receiver_loop(self) -> None:
        """Read messages from Deepgram WebSocket and dispatch callbacks."""
        logger.debug("Receiver loop started [session=%s]", self.session_id)
        try:
            assert self._ws is not None
            async for raw_message in self._ws:
                if self._stop_event.is_set():
                    break

                try:
                    msg = json.loads(raw_message)
                except (json.JSONDecodeError, TypeError):
                    logger.warning(
                        "Non-JSON message from Deepgram [session=%s]",
                        self.session_id,
                    )
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "Results":
                    await self._handle_transcript(msg)
                elif msg_type == "Metadata":
                    logger.info(
                        "Deepgram metadata [session=%s]: request_id=%s",
                        self.session_id,
                        msg.get("request_id", "unknown"),
                    )
                elif msg_type == "SpeechStarted":
                    logger.debug(
                        "Speech started [session=%s channel=%s]",
                        self.session_id,
                        msg.get("channel_index", [0]),
                    )
                elif msg_type == "UtteranceEnd":
                    logger.debug(
                        "Utterance end [session=%s]", self.session_id
                    )
                elif msg_type == "Error":
                    logger.error(
                        "Deepgram error [session=%s]: %s",
                        self.session_id,
                        msg.get("message", msg),
                    )
                elif msg_type == "CloseStream":
                    logger.info(
                        "Deepgram stream closed [session=%s]", self.session_id
                    )
                    break
                else:
                    logger.debug(
                        "Unhandled Deepgram msg type=%s [session=%s]",
                        msg_type,
                        self.session_id,
                    )

        except websockets.ConnectionClosedOK:
            logger.info(
                "Deepgram WS closed normally [session=%s]", self.session_id
            )
        except websockets.ConnectionClosedError as exc:
            logger.error(
                "Deepgram WS closed with error [session=%s]: %s",
                self.session_id,
                exc,
            )
            if not self._stop_event.is_set():
                asyncio.create_task(self._maybe_reconnect())
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error(
                "Receiver unexpected error [session=%s]: %s",
                self.session_id,
                exc,
            )
            if not self._stop_event.is_set():
                asyncio.create_task(self._maybe_reconnect())

        logger.debug("Receiver loop exited [session=%s]", self.session_id)

    async def _keepalive_loop(self) -> None:
        """Send periodic KeepAlive messages to prevent idle timeout."""
        try:
            while not self._stop_event.is_set():
                await asyncio.sleep(8)
                if self._ws and self._state == AdapterState.CONNECTED:
                    try:
                        await self._ws.send(json.dumps({"type": "KeepAlive"}))
                    except Exception:
                        break
        except asyncio.CancelledError:
            pass

    # ────────────────── Message Handling ──────────────────

    async def _handle_transcript(self, msg: Dict[str, Any]) -> None:
        """Parse a Deepgram Results message and fire callbacks."""
        try:
            channel = msg.get("channel", {})
            alternatives = channel.get("alternatives", [])
            if not alternatives:
                return

            best = alternatives[0]
            transcript_text = best.get("transcript", "").strip()
            confidence = float(best.get("confidence", 0.0))
            words = best.get("words", [])
            is_final = msg.get("is_final", False)
            speech_final = msg.get("speech_final", False)
            start = float(msg.get("start", 0.0))
            duration = float(msg.get("duration", 0.0))
            channel_index_raw = msg.get("channel_index", [0])
            channel_index = (
                channel_index_raw[0]
                if isinstance(channel_index_raw, list) and channel_index_raw
                else 0
            )

            # Skip empty interim results
            if not transcript_text and not is_final:
                return

            result = TranscriptResult(
                transcript=transcript_text,
                confidence=confidence,
                is_final=is_final,
                session_id=self.session_id,
                speech_final=speech_final,
                words=words,
                start=start,
                duration=duration,
                channel_index=channel_index,
            )

            self._transcripts_received += 1

            if is_final:
                logger.info(
                    "FINAL transcript [session=%s conf=%.3f]: %s",
                    self.session_id,
                    confidence,
                    transcript_text[:120],
                )
            else:
                logger.debug(
                    "interim transcript [session=%s conf=%.3f]: %s",
                    self.session_id,
                    confidence,
                    transcript_text[:80],
                )

            # Fire all registered callbacks without blocking each other
            await asyncio.gather(
                *(cb(result) for cb in self._callbacks),
                return_exceptions=True,
            )

        except Exception as exc:
            logger.error(
                "Transcript parse error [session=%s]: %s",
                self.session_id,
                exc,
                exc_info=True,
            )
