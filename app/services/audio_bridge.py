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
        # session_id -> {"websocket": WebSocket, "stream_sid": str, "call_sid": Optional[str]}
        self._exotel_streams: Dict[str, Dict[str, Any]] = {}
        # session_id -> Set[WebSocket]
        self._supervisors: Dict[str, Set[WebSocket]] = {}
        # session_id -> bytes count telemetry
        self._telemetry: Dict[str, Dict[str, int]] = {}
        # alias (call_sid, stream_sid, clean_id) -> canonical session_id
        self._aliases: Dict[str, str] = {}
        # session_id -> outbound supervisor frame counter
        self._supervisor_frames: Dict[str, int] = {}

    def resolve_session_id(self, identifier: Optional[str]) -> Optional[str]:
        """Authoritatively resolve any given identifier to the active Exotel session_id.
        
        Handles:
        1. Exact match in active _exotel_streams (e.g. 'EXO-03cc0510...')
        2. Known alias (call_sid, stream_sid, etc.)
        3. Prefix/suffix variations (e.g. '03cc0510...' -> 'EXO-03cc0510...')
        4. Generic dashboard placeholder (e.g. 'C-1021', 'active', 'line-1') when an active
           Exotel stream is currently live.
        """
        if not identifier or not str(identifier).strip():
            # If no identifier provided, resolve to the current active Exotel stream if exactly one exists
            if len(self._exotel_streams) == 1:
                return next(iter(self._exotel_streams.keys()))
            return None

        clean_id = str(identifier).strip()

        # 1. Exact match in active streams
        if clean_id in self._exotel_streams:
            return clean_id

        # 2. Known alias
        if clean_id in self._aliases:
            target = self._aliases[clean_id]
            if target in self._exotel_streams:
                return target

        # 3. 'EXO-' prefix check
        if not clean_id.startswith("EXO-"):
            exo_variant = f"EXO-{clean_id}"
            if exo_variant in self._exotel_streams:
                return exo_variant
        else:
            stripped = clean_id[4:]
            if stripped in self._exotel_streams:
                return stripped
            if stripped in self._aliases:
                return self._aliases[stripped]

        # 4. Partial substring or stream_sid match among active streams
        for s_id, info in self._exotel_streams.items():
            if clean_id in s_id or s_id in clean_id:
                return s_id
            if info.get("stream_sid") == clean_id or info.get("call_sid") == clean_id:
                return s_id

        # 5. Placeholder resolution fallback (e.g. dashboard using 'C-1021', 'C-1022', etc.)
        # If there is at least one active live Exotel stream, map placeholder to the live stream
        if self._exotel_streams:
            live_session_id = next(reversed(list(self._exotel_streams.keys())))
            logger.info(
                "RESOLVED RESCURO SESSION ID: Mapped placeholder '%s' to live Exotel session '%s'",
                clean_id, live_session_id
            )
            # Register this placeholder as an alias for future chunk lookups
            self._aliases[clean_id] = live_session_id
            return live_session_id

        return None

    def register_exotel_call(
        self,
        session_id: str,
        websocket: WebSocket,
        stream_sid: str,
        call_sid: Optional[str] = None
    ) -> None:
        """Register an active Exotel media WebSocket connection."""
        self._exotel_streams[session_id] = {
            "websocket": websocket,
            "stream_sid": stream_sid,
            "call_sid": call_sid,
        }
        self._telemetry.setdefault(session_id, {"caller_bytes": 0, "supervisor_bytes": 0})
        
        # Register aliases for authoritative lookup
        if stream_sid:
            self._aliases[stream_sid] = session_id
        if call_sid:
            self._aliases[call_sid] = session_id
            self._aliases[f"EXO-{call_sid}"] = session_id
        if session_id.startswith("EXO-"):
            self._aliases[session_id[4:]] = session_id

        logger.info(
            "Exotel stream registered in audio bridge: session=%s stream_sid=%s call_sid=%s",
            session_id, stream_sid, call_sid
        )

    def unregister_exotel_call(self, session_id: str) -> None:
        """Unregister an Exotel media stream when call terminates."""
        resolved = self.resolve_session_id(session_id) or session_id
        exotel_info = self._exotel_streams.pop(resolved, None)
        self._supervisors.pop(resolved, None)

        if exotel_info:
            stream_sid = exotel_info.get("stream_sid")
            call_sid = exotel_info.get("call_sid")
            if stream_sid:
                self._aliases.pop(stream_sid, None)
            if call_sid:
                self._aliases.pop(call_sid, None)
                self._aliases.pop(f"EXO-{call_sid}", None)
        self._telemetry.pop(resolved, None)
        self._supervisor_frames.pop(resolved, None)

        logger.info("Exotel stream unregistered from audio bridge: session=%s", resolved)

    def register_supervisor(self, session_id: str, websocket: WebSocket) -> str:
        """Link a supervisor console WebSocket to an active call session.
        
        Returns the resolved authoritative session_id.
        """
        resolved = self.resolve_session_id(session_id) or session_id
        if resolved not in self._supervisors:
            self._supervisors[resolved] = set()
        self._supervisors[resolved].add(websocket)

        # Also link raw identifier if different, to ensure immediate lookups succeed
        if session_id != resolved:
            if session_id not in self._supervisors:
                self._supervisors[session_id] = set()
            self._supervisors[session_id].add(websocket)

        logger.info(
            "AUDIO BRIDGE ATTACHED: session=%s (input=%s), active supervisors: %d",
            resolved, session_id, len(self._supervisors[resolved])
        )
        return resolved

    def unregister_supervisor(self, session_id: str, websocket: WebSocket) -> None:
        """Remove a supervisor console WebSocket from an active call session."""
        resolved = self.resolve_session_id(session_id) or session_id
        for s_key in {session_id, resolved}:
            if s_key in self._supervisors:
                self._supervisors[s_key].discard(websocket)
                if not self._supervisors[s_key]:
                    self._supervisors.pop(s_key, None)
        logger.info("Supervisor unregistered from audio bridge for session %s (resolved=%s)", session_id, resolved)

    def is_bridge_active(self, session_id: str) -> bool:
        """Return True if both the telephony call and a supervisor are connected."""
        resolved = self.resolve_session_id(session_id)
        if not resolved:
            return False
        return (
            resolved in self._exotel_streams
            and bool(self._supervisors.get(resolved))
        )

    def has_exotel_stream(self, session_id: str) -> bool:
        """Return True if Exotel stream is actively registered."""
        resolved = self.resolve_session_id(session_id)
        return bool(resolved and resolved in self._exotel_streams)

    def get_exotel_stream_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get the active Exotel stream info for a session."""
        resolved = self.resolve_session_id(session_id)
        if not resolved:
            return None
        return self._exotel_streams.get(resolved)

    def get_bridge_status(self, session_id: str) -> Dict[str, Any]:
        """Return status telemetry of the media bridge for this session."""
        resolved = self.resolve_session_id(session_id) or session_id
        exotel_info = self._exotel_streams.get(resolved)
        supervisors = self._supervisors.get(resolved, set())
        telemetry = self._telemetry.get(resolved, {"caller_bytes": 0, "supervisor_bytes": 0})
        return {
            "session_id": resolved,
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
        resolved = self.resolve_session_id(session_id) or session_id
        return list(self._supervisors.get(resolved, set()))

    async def clear_exotel_audio(self, session_id: str) -> bool:
        """Send an Exotel 'clear' frame to instantly flush any pending audio on the caller's phone."""
        resolved = self.resolve_session_id(session_id)
        if not resolved or resolved not in self._exotel_streams:
            return False
        exotel_info = self._exotel_streams[resolved]
        try:
            await exotel_info["websocket"].send_text(json.dumps({
                "event": "clear",
                "stream_sid": exotel_info["stream_sid"]
            }))
            logger.info("EXOTEL PLAYBACK CLEARED for session %s (stream_sid=%s)", resolved, exotel_info["stream_sid"])
            return True
        except Exception as e:
            logger.warning("Failed to send clear frame to Exotel: %s", e)
            return False

    async def route_caller_audio(self, session_id: str, pcm16_chunk: bytes) -> None:
        """Route inbound audio from the caller's phone to connected supervisors.
        
        Preserves PCM16 8kHz mono format.
        """
        resolved = self.resolve_session_id(session_id) or session_id
        supervisors = list(self._supervisors.get(resolved, set()))
        if not supervisors or not pcm16_chunk:
            return

        b64_audio = base64.b64encode(pcm16_chunk).decode("ascii")
        msg = {
            "type": "CALLER_AUDIO_CHUNK",
            "event": "CALLER_AUDIO_CHUNK",
            "session_id": resolved,
            "payload": {
                "call_id": resolved,
                "callId": resolved,
                "session_id": resolved,
                "audio": b64_audio,
                "format": "linear16_8khz_mono",
                "sample_rate": 8000,
                "sampleRate": 8000,
                "channels": 1,
            },
        }

        if resolved in self._telemetry:
            self._telemetry[resolved]["caller_bytes"] += len(pcm16_chunk)

        logger.debug(
            "CALLER AUDIO SENT TO SUPERVISOR: session=%s, bytes=%d, supervisors=%d",
            resolved, len(pcm16_chunk), len(supervisors)
        )

        dead_ws = []
        msg_str = json.dumps(msg)
        for ws in supervisors:
            try:
                await ws.send_text(msg_str)
            except Exception as e:
                logger.warning("Failed to send caller audio to supervisor: %s", e)
                dead_ws.append(ws)

        for d in dead_ws:
            self.unregister_supervisor(resolved, d)

    async def route_supervisor_audio(self, session_id: str, pcm16_chunk: bytes) -> bool:
        """Route supervisor microphone audio into the existing Exotel telephone call.
        
        Formats audio into an Exotel AgentStream 'media' frame:
        {"event": "media", "stream_sid": ..., "media": {"payload": base64_pcm16}}
        """
        resolved = self.resolve_session_id(session_id)
        if not resolved or resolved not in self._exotel_streams:
            logger.warning("Cannot route supervisor audio: No active Exotel stream for session %s (resolved=%s)", session_id, resolved)
            return False

        exotel_info = self._exotel_streams[resolved]
        exotel_ws: WebSocket = exotel_info["websocket"]
        stream_sid: str = exotel_info["stream_sid"]

        count = self._supervisor_frames.get(resolved, 0) + 1
        self._supervisor_frames[resolved] = count

        if count in (1, 5, 10) or count % 25 == 0:
            logger.info(
                "SUPERVISOR AUDIO RECEIVED\n"
                "- session_id: %s\n"
                "- audio bytes: %d\n"
                "- sample rate: 8000\n"
                "- channels: 1\n"
                "- encoding: linear16",
                resolved,
                len(pcm16_chunk),
            )
        else:
            logger.debug("SUPERVISOR AUDIO RECEIVED: session=%s, bytes=%d, frame=%d", resolved, len(pcm16_chunk), count)

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
            if resolved in self._telemetry:
                self._telemetry[resolved]["supervisor_bytes"] += len(pcm16_chunk)
            
            ws_state = getattr(getattr(exotel_ws, "client_state", None), "name", "CONNECTED")
            if count in (1, 5, 10) or count % 25 == 0:
                logger.info(
                    "SUPERVISOR AUDIO → EXOTEL\n"
                    "- session_id: %s\n"
                    "- stream_sid: %s\n"
                    "- payload bytes: %d\n"
                    "- number of frames: %d\n"
                    "- WebSocket state: %s",
                    resolved,
                    stream_sid,
                    len(pcm16_chunk),
                    count,
                    ws_state,
                )
            else:
                logger.debug(
                    "SUPERVISOR AUDIO SENT TO EXOTEL: session=%s, stream_sid=%s, bytes=%d, frame=%d",
                    resolved, stream_sid, len(pcm16_chunk), count
                )
            return True
        except Exception as err:
            logger.error("Failed to send supervisor audio frame to Exotel (%s): %s", resolved, err)
            return False


# Global singleton instance
audio_bridge = AudioBridgeManager()
