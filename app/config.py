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
    OPENAI_API_KEY: Optional[str] = None
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_VOICE_ID: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Return parsed list of CORS origins."""
        if not self.CORS_ORIGINS or self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

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


settings = Settings()
