"""Application configuration and environment management with .env loading."""

import os
import logging
from typing import List, Optional
from dotenv import load_dotenv

# Load .env file automatically
load_dotenv()

logger = logging.getLogger("echosphere.config")


class Settings:
    """Application settings read from environment variables with graceful defaults."""

    # OpenAI Intelligence Engine
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Deepgram Speech-to-Text (Nova-2 multilingual)
    DEEPGRAM_API_KEY: Optional[str] = os.getenv("DEEPGRAM_API_KEY")

    # Twilio Telephony Credentials
    TWILIO_ACCOUNT_SID: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER: Optional[str] = os.getenv("TWILIO_PHONE_NUMBER")

    # Supabase Database & Auth (supports both naming conventions)
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
    SUPABASE_SERVICE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

    # Agora Real-Time Communication & Conversational Engine
    AGORA_APP_ID: Optional[str] = os.getenv("AGORA_APP_ID")
    AGORA_APP_CERTIFICATE: Optional[str] = os.getenv("AGORA_APP_CERTIFICATE")
    AGORA_CUSTOMER_KEY: Optional[str] = os.getenv("AGORA_CUSTOMER_KEY")
    AGORA_CUSTOMER_SECRET: Optional[str] = os.getenv("AGORA_CUSTOMER_SECRET")

    # Slack Alert Notifications (Block Kit)
    SLACK_WEBHOOK_URL: Optional[str] = os.getenv("SLACK_WEBHOOK_URL")

    # Telnyx Programmable Voice & Call Control
    TELNYX_API_KEY: Optional[str] = os.getenv("TELNYX_API_KEY")
    TELNYX_PUBLIC_KEY: Optional[str] = os.getenv("TELNYX_PUBLIC_KEY")
    TELNYX_CONNECTION_ID: Optional[str] = os.getenv("TELNYX_CONNECTION_ID")
    TELNYX_APPLICATION_ID: Optional[str] = os.getenv("TELNYX_APPLICATION_ID")
    TELNYX_MEDIA_WS_URL: Optional[str] = os.getenv("TELNYX_MEDIA_WS_URL")
    TELNYX_MEDIA_STREAM_PATH: str = os.getenv("TELNYX_MEDIA_STREAM_PATH", "/telnyx/media")
    TELNYX_WEBHOOK_PATH: str = os.getenv("TELNYX_WEBHOOK_PATH", "/telnyx/webhook")

    # Operational Parameters
    CONFIDENCE_ESCALATION_THRESHOLD: float = float(os.getenv("CONFIDENCE_ESCALATION_THRESHOLD", 0.65))

    # App Routing & Networking
    PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
    MEDIA_STREAM_PATH: str = os.getenv("MEDIA_STREAM_PATH", "/voice/stream")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    @property
    def websocket_stream_url(self) -> str:
        """Derive WebSocket URL for Twilio Media Stream from PUBLIC_BASE_URL."""
        base = self.PUBLIC_BASE_URL.rstrip("/")
        if base.startswith("https://"):
            ws_base = "wss://" + base[8:]
        elif base.startswith("http://"):
            ws_base = "ws://" + base[7:]
        else:
            ws_base = f"wss://{base}"
        return f"{ws_base}{self.MEDIA_STREAM_PATH}"

    @property
    def telnyx_websocket_url(self) -> str:
        """Derive WebSocket URL for Telnyx bidirectional media stream."""
        if self.TELNYX_MEDIA_WS_URL:
            return self.TELNYX_MEDIA_WS_URL
        base = self.PUBLIC_BASE_URL.rstrip("/")
        if base.startswith("https://"):
            ws_base = "wss://" + base[8:]
        elif base.startswith("http://"):
            ws_base = "ws://" + base[7:]
        else:
            ws_base = f"wss://{base}"
        return f"{ws_base}{self.TELNYX_MEDIA_STREAM_PATH}"


settings = Settings()


def verify_required_keys(exit_on_failure: bool = False) -> List[str]:
    """Validates configuration keys and reports any missing settings."""
    required = [
        ("OPENAI_API_KEY", settings.OPENAI_API_KEY),
        ("DEEPGRAM_API_KEY", settings.DEEPGRAM_API_KEY),
        ("TWILIO_ACCOUNT_SID", settings.TWILIO_ACCOUNT_SID),
        ("TWILIO_AUTH_TOKEN", settings.TWILIO_AUTH_TOKEN),
        ("SUPABASE_URL", settings.SUPABASE_URL),
        ("SUPABASE_SERVICE_KEY", settings.SUPABASE_SERVICE_KEY),
        ("SLACK_WEBHOOK_URL", settings.SLACK_WEBHOOK_URL),
    ]
    missing = [k for k, v in required if not v or str(v).startswith("your_")]
    if missing:
        logger.warning("Unconfigured environment variables: %s", ", ".join(missing))
    return missing
