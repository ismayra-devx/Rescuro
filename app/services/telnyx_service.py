"""Telnyx Voice & Call Control service adapter.

Provides:
- Ed25519 webhook signature validation
- Telnyx Call Control REST client (answer, start streaming, hangup)
- TeXML streaming response generator
- Inbound/outbound audio framing helpers (base64, u-law)
"""

import base64
import logging
from typing import Any, Dict, Optional
import httpx
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.exceptions import InvalidSignature

try:
    from app.config import settings
except ImportError:
    from config import settings

logger = logging.getLogger("echosphere.telnyx")

TELNYX_API_BASE = "https://api.telnyx.com/v2"


class TelnyxService:
    """Telnyx Programmable Voice & Call Control service."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        public_key: Optional[str] = None,
    ):
        self.api_key = (api_key or settings.TELNYX_API_KEY or "").strip()
        self.public_key = (public_key or settings.TELNYX_PUBLIC_KEY or "").strip()

    def validate_signature(
        self,
        raw_body: bytes,
        signature_b64: Optional[str],
        timestamp: Optional[str],
    ) -> bool:
        """Validates inbound Telnyx webhook Ed25519 signature.
        
        If TELNYX_PUBLIC_KEY is unconfigured or placeholder, signature validation
        is skipped to support development & testing environments gracefully.
        """
        if not self.public_key or self.public_key.startswith("your_"):
            logger.debug("Telnyx public key not configured; skipping signature validation.")
            return True

        if not signature_b64 or not timestamp:
            logger.warning("Missing Telnyx signature or timestamp header.")
            return False

        try:
            pub_bytes = base64.b64decode(self.public_key)
            sig_bytes = base64.b64decode(signature_b64)
            signed_payload = f"{timestamp}|".encode("utf-8") + raw_body

            verifier = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
            verifier.verify(sig_bytes, signed_payload)
            return True
        except (InvalidSignature, ValueError, Exception) as exc:
            logger.warning(f"Telnyx signature validation failed: {exc}")
            return False

    async def answer_call(
        self,
        call_control_id: str,
        client_state: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Sends Call Control action to answer the incoming call."""
        if not self.api_key or self.api_key.startswith("your_"):
            logger.debug(f"Telnyx API key not configured; simulated answer for {call_control_id}")
            return {"result": "ok", "action": "answer", "simulated": True}

        url = f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/answer"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body: Dict[str, Any] = {}
        if client_state:
            body["client_state"] = client_state

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code in (200, 202):
                return resp.json()
            logger.warning(f"Telnyx answer failed ({resp.status_code}): {resp.text}")
            return {"error": resp.text, "status_code": resp.status_code}

    async def start_streaming(
        self,
        call_control_id: str,
        stream_url: str,
        stream_track: str = "both_tracks",
        client_state: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Starts bidirectional audio streaming via Telnyx Call Control API."""
        if not self.api_key or self.api_key.startswith("your_"):
            logger.debug(f"Telnyx API key not configured; simulated streaming_start for {call_control_id}")
            return {"result": "ok", "action": "streaming_start", "simulated": True}

        url = f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/streaming_start"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body: Dict[str, Any] = {
            "stream_url": stream_url,
            "stream_track": stream_track,
            "enable_dialogflow": False,
            "stream_bidirectional_mode": "rtp",
        }
        if client_state:
            body["client_state"] = client_state

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code in (200, 202):
                return resp.json()
            logger.warning(f"Telnyx streaming_start failed ({resp.status_code}): {resp.text}")
            return {"error": resp.text, "status_code": resp.status_code}

    async def stop_streaming(self, call_control_id: str) -> Dict[str, Any]:
        """Stops audio streaming via Telnyx Call Control."""
        if not self.api_key or self.api_key.startswith("your_"):
            return {"result": "ok", "action": "streaming_stop", "simulated": True}

        url = f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/streaming_stop"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers=headers, json={})
            if resp.status_code in (200, 202):
                return resp.json()
            return {"error": resp.text, "status_code": resp.status_code}

    async def hangup_call(self, call_control_id: str) -> Dict[str, Any]:
        """Hangs up the call via Telnyx Call Control."""
        if not self.api_key or self.api_key.startswith("your_"):
            return {"result": "ok", "action": "hangup", "simulated": True}

        url = f"{TELNYX_API_BASE}/calls/{call_control_id}/actions/hangup"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, headers=headers, json={})
            if resp.status_code in (200, 202):
                return resp.json()
            return {"error": resp.text, "status_code": resp.status_code}

    def generate_stream_texml(
        self,
        stream_url: str,
        session_id: str,
        call_control_id: Optional[str] = None,
    ) -> str:
        """Generates TeXML response to connect call to WebSocket media stream immediately."""
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            "<Response>\n"
            "    <Connect>\n"
            f'        <Stream url="{stream_url}">\n'
            f'            <Parameter name="session_id" value="{session_id}" />\n'
            f'            <Parameter name="call_control_id" value="{call_control_id or ""}" />\n'
            "        </Stream>\n"
            "    </Connect>\n"
            "</Response>"
        )

    @staticmethod
    def create_media_message(audio_bytes: bytes, stream_id: Optional[str] = None) -> Dict[str, Any]:
        """Constructs outbound Telnyx WebSocket media message frame."""
        msg: Dict[str, Any] = {
            "event": "media",
            "media": {
                "payload": base64.b64encode(audio_bytes).decode("ascii"),
            },
        }
        if stream_id:
            msg["stream_id"] = stream_id
        return msg

    @staticmethod
    def create_clear_message(stream_id: Optional[str] = None) -> Dict[str, Any]:
        """Constructs Telnyx buffer clear message frame (e.g. for supervisor intervention)."""
        msg: Dict[str, Any] = {"event": "clear"}
        if stream_id:
            msg["stream_id"] = stream_id
        return msg

    @staticmethod
    def decode_media_payload(payload_b64: str) -> bytes:
        """Decodes inbound Telnyx Base64 audio payload to raw bytes."""
        return base64.b64decode(payload_b64)


telnyx_service = TelnyxService()
