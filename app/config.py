"""Application configuration and environment management."""

import os
from typing import Optional


class Settings:
    """Application settings read from environment variables with graceful defaults."""

    # OpenAI
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Deepgram
    DEEPGRAM_API_KEY: Optional[str] = os.getenv("DEEPGRAM_API_KEY")

    # Twilio
    TWILIO_ACCOUNT_SID: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER: Optional[str] = os.getenv("TWILIO_PHONE_NUMBER")

    # Supabase
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_KEY")

    # Agora
    AGORA_APP_ID: Optional[str] = os.getenv("AGORA_APP_ID")
    AGORA_APP_CERTIFICATE: Optional[str] = os.getenv("AGORA_APP_CERTIFICATE")

    # App Routing & Networking
    PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
    MEDIA_STREAM_PATH: str = os.getenv("MEDIA_STREAM_PATH", "/media/stream")
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


settings = Settings()
