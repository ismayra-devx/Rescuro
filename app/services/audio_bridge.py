"""Real-time Audio Bridge Service for RESCURO.

Bridges active Exotel telephone streams (8kHz mono linear16 PCM) directly
with authenticated supervisor dashboards (WebSockets / Web Audio API)
and optional Agora RTC voice channels.

Media Path:
Caller Phone <-> Exotel <-> AudioBridgeManager <-> Supervisor Dashboard / Headset
"""

import base64
import json
import logging
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger("rescuro.audio_bridge")


class AudioBridgeManager:
    """Manages active bidirectional audio bridges between Exotel telephony and supervisor consoles."""

    def __init__(self):
        # session_id -> {"websocket": WebSocket, "stream_sid": str}
        self._exotel_streams: Dict[str, Dict[str, Any]] = {}
        # session_id -> Set[WebSocket]
        self._supervisors: Dict[str, Set[WebSocket]] = {}
        # session_id -> bytes count telemetry
        self._telemetry: Dict[str, Dict[str, int]] = {}

    def register_exotel_call(self, session_id: str, websocket: WebSocket, stream_sid: str) -> None:
        """Register an active Exotel media WebSocket connection."""
        self._exotel_streams[session_id] = {
            "websocket": websocket,
            "stream_sid": stream_sid,
        }
        self._telemetry.setdefault(session_id, {"caller_bytes": 0, "supervisor_bytes": 0})
        logger.info(
            "Exotel stream registered in audio bridge: session=%s stream_sid=%s",
            session_id, stream_sid
        )

    def unregister_exotel_call(self, session_id: str) -> None:
        """Unregister an Exotel media stream when call terminates."""
        self._exotel_streams.pop(session_id, None)
        self._supervisors.pop(session_id, None)
        logger.info("Exotel stream unregistered from audio bridge: session=%s", session_id)

    def register_supervisor(self, session_id: str, websocket: WebSocket) -> None:
        """Link a supervisor console WebSocket to an active call session."""
        if session_id not in self._supervisors:
            self._supervisors[session_id] = set()
        self._supervisors[session_id].add(websocket)
        logger.info(
            "Supervisor registered to audio bridge for session %s (active supervisors: %d)",
            session_id, len(self._supervisors[session_id])
        )

    def unregister_supervisor(self, session_id: str, websocket: WebSocket) -> None:
        """Remove a supervisor console WebSocket from an active call session."""
        if session_id in self._supervisors:
            self._supervisors[session_id].discard(websocket)
            if not self._supervisors[session_id]:
                self._supervisors.pop(session_id, None)
        logger.info("Supervisor unregistered from audio bridge for session %s", session_id)

    def is_bridge_active(self, session_id: str) -> bool:
        """Return True if both the telephony call and a supervisor are connected."""
        return (
            session_id in self._exotel_streams
            and bool(self._supervisors.get(session_id))
        )

    def has_exotel_stream(self, session_id: str) -> bool:
        """Return True if Exotel stream is actively registered."""
        return session_id in self._exotel_streams

    def get_bridge_status(self, session_id: str) -> Dict[str, Any]:
        """Return status telemetry of the media bridge for this session."""
        exotel_info = self._exotel_streams.get(session_id)
        supervisors = self._supervisors.get(session_id, set())
        telemetry = self._telemetry.get(session_id, {"caller_bytes": 0, "supervisor_bytes": 0})
        return {
            "session_id": session_id,
            "connected": bool(exotel_info and supervisors),
            "telephony_active": bool(exotel_info),
            "stream_sid": exotel_info.get("stream_sid") if exotel_info else None,
            "supervisors_connected": len(supervisors),
            "caller_bytes_streamed": telemetry["caller_bytes"],
            "supervisor_bytes_streamed": telemetry["supervisor_bytes"],
        }

    def register_exotel_stream(self, session_id: str, websocket: WebSocket, stream_sid: str) -> None:
        """Alias for register_exotel_call."""
        self.register_exotel_call(session_id, websocket, stream_sid)

    def unregister_exotel_stream(self, session_id: str) -> None:
        """Alias for unregister_exotel_call."""
        self.unregister_exotel_call(session_id)

    def is_exotel_connected(self, session_id: str) -> bool:
        """Alias for has_exotel_stream."""
        return self.has_exotel_stream(session_id)

    def get_supervisors(self, session_id: str) -> List[WebSocket]:
        """Return list of connected supervisor WebSockets."""
        return list(self._supervisors.get(session_id, set()))

    async def route_caller_audio(self, session_id: str, pcm16_chunk: bytes) -> None:
        """Route inbound audio from the caller's phone to connected supervisors.
        
        Preserves PCM16 8kHz mono format.
        """
        supervisors = list(self._supervisors.get(session_id, set()))
        if not supervisors or not pcm16_chunk:
            return

        b64_audio = base64.b64encode(pcm16_chunk).decode("ascii")
        msg = {
            "type": "CALLER_AUDIO_CHUNK",
            "event": "CALLER_AUDIO_CHUNK",
            "session_id": session_id,
            "payload": {
                "call_id": session_id,
                "callId": session_id,
                "audio": b64_audio,
                "format": "linear16_8khz_mono",
                "sample_rate": 8000,
                "sampleRate": 8000,
                "channels": 1,
            },
        }

        if session_id in self._telemetry:
            self._telemetry[session_id]["caller_bytes"] += len(pcm16_chunk)

        dead_ws = []
        msg_str = json.dumps(msg)
        for ws in supervisors:
            try:
                await ws.send_text(msg_str)
            except Exception as e:
                logger.warning("Failed to send caller audio to supervisor: %s", e)
                dead_ws.append(ws)

        for d in dead_ws:
            self.unregister_supervisor(session_id, d)

    async def route_supervisor_audio(self, session_id: str, pcm16_chunk: bytes) -> bool:
        """Route supervisor microphone audio into the existing Exotel telephone call.
        
        Formats audio into an Exotel AgentStream 'media' frame:
        {"event": "media", "stream_sid": ..., "media": {"payload": base64_pcm16}}
        """
        exotel_info = self._exotel_streams.get(session_id)
        if not exotel_info:
            # Fallback check by call_sid prefix
            for s_id, info in self._exotel_streams.items():
                if session_id in s_id or s_id in session_id:
                    exotel_info = info
                    session_id = s_id
                    break

        if not exotel_info:
            logger.warning("Cannot route supervisor audio: No active Exotel stream for session %s", session_id)
            return False

        exotel_ws: WebSocket = exotel_info["websocket"]
        stream_sid: str = exotel_info["stream_sid"]

        b64_audio = base64.b64encode(pcm16_chunk).decode("ascii")
        outbound_frame = {
            "event": "media",
            "stream_sid": stream_sid,
            "media": {
                "payload": b64_audio,
            },
        }

        try:
            await exotel_ws.send_text(json.dumps(outbound_frame))
            if session_id in self._telemetry:
                self._telemetry[session_id]["supervisor_bytes"] += len(pcm16_chunk)
            return True
        except Exception as err:
            logger.error("Failed to send supervisor audio frame to Exotel (%s): %s", session_id, err)
            return False


# Global singleton instance
audio_bridge = AudioBridgeManager()
