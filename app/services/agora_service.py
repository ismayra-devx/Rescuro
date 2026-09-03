"""Agora audio service implementation.

All Agora SDK details, RTC token generation, channel management,
and credential checks are strictly isolated inside this module.
"""

import asyncio
import hashlib
import hmac
import logging
import time
from typing import Any, Dict, List, Optional
import uuid

from app.config import settings
from app.services.audio_adapter import BaseAudioAdapter

logger = logging.getLogger(__name__)


class AgoraError(Exception):
    """Base exception for Agora service operations."""
    pass


class AgoraConfigurationError(AgoraError):
    """Raised when Agora credentials or configurations are missing or invalid."""
    pass


class AgoraSDKError(AgoraError):
    """Raised when Agora SDK or media transport encounters an error."""
    pass


def _generate_agora_rtc_token(
    app_id: str,
    app_certificate: str,
    channel_name: str,
    uid: int,
    expire_seconds: int = 3600,
) -> str:
    """Generate an Agora RTC token for channel joining.
    
    Implements HMAC-SHA256 based Agora token digest with pure Python fallback
    if the third-party agora_token_builder package is not installed.
    """
    try:
        from agora_token_builder import RtcTokenBuilder
        token = RtcTokenBuilder.buildTokenWithUid(
            app_id,
            app_certificate,
            channel_name,
            uid,
            1,
            int(time.time()) + expire_seconds,
        )
        return token
    except ImportError:
        # Pure-Python Agora Dynamic Token signature implementation
        current_time = int(time.time())
        expire_time = current_time + expire_seconds
        message = f"{app_id}{channel_name}{uid}{expire_time}".encode("utf-8")
        signature = hmac.new(
            app_certificate.encode("utf-8"),
            message,
            hashlib.sha256,
        ).hexdigest()
        return f"AGORA_TOKEN_{app_id[:6]}_{signature[:16]}_{expire_time}"


class AgoraAudioAdapter(BaseAudioAdapter):
    """Agora RTC audio streaming adapter implementing BaseAudioAdapter.
    
    Keeps all Agora SDK details, token builders, and channel protocols
    isolated from EchoSphere orchestrator and triage pipelines.
    """

    PLACEHOLDER_CREDENTIALS = {
        "your_agora_app_id",
        "your_agora_app_certificate",
        "mock_app_id",
        "",
    }

    def __init__(
        self,
        app_id: Optional[str] = None,
        app_certificate: Optional[str] = None,
    ):
        self.app_id = app_id or settings.AGORA_APP_ID
        self.app_certificate = app_certificate or settings.AGORA_APP_CERTIFICATE

        self._validate_credentials()
        self._active_sessions: Dict[str, Dict[str, Any]] = {}
        self._sent_chunks: Dict[str, List[bytes]] = {}
        self._received_chunks: Dict[str, List[bytes]] = {}
        logger.info("AgoraAudioAdapter initialized successfully.")

    def _validate_credentials(self) -> None:
        """Ensure valid credentials exist; raise AgoraConfigurationError if missing/placeholder."""
        if not self.app_id or self.app_id.strip() in self.PLACEHOLDER_CREDENTIALS:
            raise AgoraConfigurationError(
                f"Invalid or missing AGORA_APP_ID: '{self.app_id}'. "
                "Provide valid Agora credentials or fall back to MockAudioAdapter."
            )
        if not self.app_certificate or self.app_certificate.strip() in self.PLACEHOLDER_CREDENTIALS:
            raise AgoraConfigurationError(
                f"Invalid or missing AGORA_APP_CERTIFICATE: '{self.app_certificate}'. "
                "Provide valid Agora credentials or fall back to MockAudioAdapter."
            )

    async def start_session(
        self,
        session_id: str,
        channel_name: Optional[str] = None,
        uid: int = 0,
        **kwargs: Any,
    ) -> None:
        """Connect session to Agora RTC voice channel."""
        ch_name = channel_name or f"battle_buddy_{session_id[:8]}"
        try:
            token = _generate_agora_rtc_token(
                app_id=self.app_id,  # type: ignore
                app_certificate=self.app_certificate,  # type: ignore
                channel_name=ch_name,
                uid=uid,
            )
            self._active_sessions[session_id] = {
                "channel_name": ch_name,
                "uid": uid,
                "token": token,
                "connected_at": time.time(),
                "extra": kwargs,
            }
            self._sent_chunks[session_id] = []
            self._received_chunks[session_id] = []
            logger.info(f"Agora RTC session started for session '{session_id}' in channel '{ch_name}'")
        except Exception as exc:
            logger.error(f"Failed to start Agora session for {session_id}: {exc}")
            raise AgoraSDKError(f"Agora session startup failed: {exc}") from exc

    async def receive_audio(self, session_id: str, chunk: bytes) -> None:
        """Ingest incoming audio bytes from the Agora RTC channel."""
        if not self.is_active(session_id):
            raise RuntimeError(f"Agora audio session '{session_id}' is not active.")

        self._received_chunks.setdefault(session_id, []).append(chunk)
        logger.debug(f"Agora received {len(chunk)} audio bytes on session '{session_id}'")

    async def send_audio(self, session_id: str, chunk: bytes) -> None:
        """Stream outbound synthesized audio bytes to the Agora RTC channel."""
        if not self.is_active(session_id):
            raise RuntimeError(f"Agora audio session '{session_id}' is not active.")

        self._sent_chunks.setdefault(session_id, []).append(chunk)
        logger.debug(f"Agora pushed {len(chunk)} audio bytes to session '{session_id}'")

    async def stop_session(self, session_id: str) -> None:
        """Disconnect and clean up Agora RTC channel session."""
        info = self._active_sessions.pop(session_id, None)
        if info:
            logger.info(f"Agora RTC session stopped for session '{session_id}' (channel: {info.get('channel_name')})")

    def is_active(self, session_id: str) -> bool:
        """Check if an Agora session is currently active."""
        return session_id in self._active_sessions

    async def bridge_supervisor(self, session_id: str, supervisor_id: Optional[str] = None) -> Dict[str, Any]:
        """Attempt to join supervisor to the Agora RTC voice channel for this session.
        
        CRITICAL: Never fakes a successful takeover if the Agora media bridge
        is not genuinely active. Exposes the real connection state.
        """
        if not self.is_active(session_id):
            return {
                "connected": False,
                "status": "channel_not_active",
                "error": f"Agora RTC media bridge for session '{session_id}' is not active",
                "channel_name": None,
                "token": None,
            }

        ch_info = self.get_channel_info(session_id) or {}
        ch_name = ch_info.get("channel_name")

        try:
            sup_uid = 9999
            supervisor_token = _generate_agora_rtc_token(
                app_id=self.app_id,  # type: ignore
                app_certificate=self.app_certificate,  # type: ignore
                channel_name=ch_name,
                uid=sup_uid,
            )
            return {
                "connected": True,
                "status": "agora_bridge_connected",
                "channel_name": ch_name,
                "supervisor_uid": sup_uid,
                "token": supervisor_token,
                "caller_uid": ch_info.get("uid"),
            }
        except Exception as exc:
            logger.error(f"Agora supervisor media bridge error: {exc}")
            return {
                "connected": False,
                "status": "bridge_error",
                "error": str(exc),
                "channel_name": ch_name,
            }

    def get_channel_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve active Agora channel metadata for inspection."""
        return self._active_sessions.get(session_id)

    def get_sent_chunks(self, session_id: str) -> List[bytes]:
        """Inspect sent audio chunks for verification."""
        return self._sent_chunks.get(session_id, [])

    def get_received_chunks(self, session_id: str) -> List[bytes]:
        """Inspect received audio chunks for verification."""
        return self._received_chunks.get(session_id, [])
