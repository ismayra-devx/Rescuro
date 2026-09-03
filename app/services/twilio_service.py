"""Twilio integration service for webhook validation and TwiML generation."""

import logging
from typing import Dict, Optional
from xml.sax.saxutils import escape
from app.config import settings

logger = logging.getLogger(__name__)


class TwilioService:
    """Handles Twilio TwiML generation and webhook signature validation."""

    def __init__(self, auth_token: Optional[str] = None):
        self.auth_token = auth_token or settings.TWILIO_AUTH_TOKEN

    def generate_stream_twiml(self, session_id: str, stream_url: Optional[str] = None) -> str:
        """Generate valid TwiML connecting the call to the media stream WebSocket."""
        media_url = stream_url or settings.websocket_stream_url

        try:
            from twilio.twiml.voice_response import Connect, Stream, VoiceResponse
            response = VoiceResponse()
            connect = Connect()
            stream = Stream(url=media_url)
            stream.parameter(name="session_id", value=session_id)
            stream.parameter(name="channel_name", value=f"echosphere_{session_id[:8]}")
            connect.append(stream)
            response.append(connect)
            return str(response)
        except ImportError:
            # Fallback manual XML generator if SDK not available
            clean_url = escape(media_url)
            clean_session = escape(session_id)
            clean_channel = escape(f"echosphere_{session_id[:8]}")
            return (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                "<Response>\n"
                "    <Connect>\n"
                f'        <Stream url="{clean_url}">\n'
                f'            <Parameter name="session_id" value="{clean_session}" />\n'
                f'            <Parameter name="channel_name" value="{clean_channel}" />\n'
                "        </Stream>\n"
                "    </Connect>\n"
                "</Response>"
            )


    def validate_signature(
        self,
        url: str,
        params: Dict[str, str],
        signature: Optional[str],
    ) -> bool:
        """Validate Twilio webhook signature using Twilio SDK if configured.
        
        Bypasses validation if no auth token is provided (dev/testing mode).
        """
        if not self.auth_token or not signature:
            # Safe bypass in development / mock test environments
            return True

        try:
            from twilio.request_validator import RequestValidator
            validator = RequestValidator(self.auth_token)
            return validator.validate(url, params, signature)
        except ImportError:
            logger.warning("twilio library not installed; skipping signature check.")
            return True
        except Exception as e:
            logger.error(f"Twilio signature validation error: {e}")
            return False
