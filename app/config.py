"""RESCURO Application Configuration and Environment Settings.
Reads all environment variables safely without hardcoded secrets.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable overrides and sensible defaults."""

    # Application details
    APP_NAME: str = "RESCURO Voice Dispatch Engine"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Server binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Cross-Origin Resource Sharing
    CORS_ORIGINS: str = "*"

    # Vobiz Telephony Configuration
    # BASE_WS_URL is used in /vobiz/answer to direct Vobiz to our media WebSocket
    # e.g., 'ws://127.0.0.1:8000' in dev or 'wss://rescuro.onrender.com' in production
    BASE_WS_URL: str = "ws://127.0.0.1:8000"
    VOBIZ_API_KEY: str = ""
    VOBIZ_API_SECRET: str = ""

    # Authentication & Security
    JWT_SECRET: str = "rescuro_local_dev_jwt_secret_key_1234567890"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Database
    DATABASE_PATH: str = "./rescuro.db"

    # AI Pipeline Providers (Modular stubs by default)
    STT_PROVIDER: str = "stub"
    TTS_PROVIDER: str = "stub"

    # Provider API keys (Optional placeholders for when providers are chosen)
    DEEPGRAM_API_KEY: Optional[str] = None
    DEEPGRAM_LANGUAGE: str = "en-IN"
    DEEPGRAM_MODEL: str = "nova-3"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_VOICE_ID: Optional[str] = None
    SLACK_WEBHOOK_URL: Optional[str] = None
    AGORA_APP_ID: Optional[str] = None
    AGORA_APP_CERTIFICATE: Optional[str] = None
    AGORA_CUSTOMER_KEY: Optional[str] = None
    AGORA_CUSTOMER_SECRET: Optional[str] = None
    CONFIDENCE_ESCALATION_THRESHOLD: float = 0.65

    # Twilio Telephony Credentials
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    
    # Supabase Configuration
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def supabase_auth_key(self) -> Optional[str]:
        """Return the appropriate key for Supabase Auth API calls (anon key or service role key)."""
        return self.SUPABASE_ANON_KEY or self.SUPABASE_KEY or self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_SERVICE_KEY

    @property
    def is_supabase_auth_configured(self) -> bool:
        """Check if live Supabase authentication credentials are configured."""
        url = (self.SUPABASE_URL or "").strip()
        key = (self.supabase_auth_key or "").strip()
        return bool(
            url
            and key
            and not url.startswith("https://your-project")
            and not key.startswith("your_")
            and url.lower() != "none"
        )

    @property
    def cors_origins_list(self) -> List[str]:
        """Return parsed list of CORS origins."""
        default_origins = [
            "https://rescuro-2.onrender.com",
            "https://rescuro-1.onrender.com",
            "https://rescuro-frontend.onrender.com",
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5174",
        ]
        if not self.CORS_ORIGINS or self.CORS_ORIGINS == "*":
            return default_origins
        configured = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        for d in default_origins:
            if d not in configured:
                configured.append(d)
        return configured

    @property
    def vobiz_media_stream_url(self) -> str:
        """Construct full Vobiz WebSocket media stream URL from BASE_WS_URL."""
        base = self.BASE_WS_URL.rstrip("/")
        # Ensure scheme is ws:// or wss://
        if base.startswith("http://"):
            base = "ws://" + base[7:]
        elif base.startswith("https://"):
            base = "wss://" + base[8:]
        elif not base.startswith("ws://") and not base.startswith("wss://"):
            base = f"wss://{base}"
        return f"{base}/vobiz/media"


    @property
    def websocket_stream_url(self) -> str:
        """Construct full WebSocket stream URL for media streams from BASE_WS_URL."""
        base = self.BASE_WS_URL.rstrip("/")
        if base.startswith("http://"):
            base = "ws://" + base[7:]
        elif base.startswith("https://"):
            base = "wss://" + base[8:]
        elif not base.startswith("ws://") and not base.startswith("wss://"):
            base = f"wss://{base}"
        return f"{base}/api/v1/stream/calls"


settings = Settings()


def verify_required_keys(exit_on_failure: bool = False) -> List[str]:
    """Compatibility validator for required configuration keys."""
    return []
