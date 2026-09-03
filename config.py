import os
import sys
import logging
from typing import List
from dotenv import load_dotenv
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    # Graceful fallback if pydantic-settings is not yet installed
    from pydantic import BaseModel as BaseSettings
    class SettingsConfigDict(dict):
        def __init__(self, **kwargs):
            super().__init__(**kwargs)
from pydantic import Field

load_dotenv()

logger = logging.getLogger("echosphere.config")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

class Settings(BaseSettings):
    # Agora Credentials
    AGORA_APP_ID: str = Field(default_factory=lambda: os.getenv("AGORA_APP_ID", ""), description="Agora App ID")
    AGORA_APP_CERTIFICATE: str = Field(default_factory=lambda: os.getenv("AGORA_APP_CERTIFICATE", ""), description="Agora App Certificate")
    AGORA_CUSTOMER_KEY: str = Field(default_factory=lambda: os.getenv("AGORA_CUSTOMER_KEY", ""), description="Agora Customer Key / Basic Auth ID")
    AGORA_CUSTOMER_SECRET: str = Field(default_factory=lambda: os.getenv("AGORA_CUSTOMER_SECRET", ""), description="Agora Customer Secret")

    # Twilio Telephony Credentials
    TWILIO_ACCOUNT_SID: str = Field(default_factory=lambda: os.getenv("TWILIO_ACCOUNT_SID", ""), description="Twilio Account SID")
    TWILIO_AUTH_TOKEN: str = Field(default_factory=lambda: os.getenv("TWILIO_AUTH_TOKEN", ""), description="Twilio Auth Token")
    TWILIO_PHONE_NUMBER: str = Field(default_factory=lambda: os.getenv("TWILIO_PHONE_NUMBER", ""), description="Twilio Inbound Phone Number")

    # Deepgram Speech-to-Text
    DEEPGRAM_API_KEY: str = Field(default_factory=lambda: os.getenv("DEEPGRAM_API_KEY", ""), description="Deepgram API Key")

    # OpenAI Intelligence Engine
    OPENAI_API_KEY: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""), description="OpenAI API Key")

    # Supabase Database & Auth
    SUPABASE_URL: str = Field(default_factory=lambda: os.getenv("SUPABASE_URL", ""), description="Supabase Project URL")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default_factory=lambda: os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""), description="Supabase Service Role Key")

    # Slack Alert Notifications
    SLACK_WEBHOOK_URL: str = Field(default_factory=lambda: os.getenv("SLACK_WEBHOOK_URL", ""), description="Slack Incoming Webhook URL")

    # Operational Parameters
    CONFIDENCE_ESCALATION_THRESHOLD: float = Field(
        default_factory=lambda: float(os.getenv("CONFIDENCE_ESCALATION_THRESHOLD", 0.65)),
        ge=0.0,
        le=1.0,
        description="Confidence threshold (0.0 - 1.0) below which automated calls escalate to human"
    )

    # Server Network
    HOST: str = Field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"), description="Server bind host")
    PORT: int = Field(default_factory=lambda: int(os.getenv("PORT", 8000)), description="Server bind port")
    ENVIRONMENT: str = Field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"), description="Environment mode: development/production")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Instantiate singleton settings
settings = Settings()

def verify_required_keys(exit_on_failure: bool = True) -> List[str]:
    """
    Validates that all critical environment credentials are present and not left as placeholders.
    Called at application startup to fail fast and prevent silent runtime failures.
    
    Args:
        exit_on_failure: If True, terminates the process with exit code 1 on missing keys.
        
    Returns:
        List of missing or invalid setting keys.
    """
    required_keys = [
        ("AGORA_APP_ID", settings.AGORA_APP_ID),
        ("AGORA_APP_CERTIFICATE", settings.AGORA_APP_CERTIFICATE),
        ("AGORA_CUSTOMER_KEY", settings.AGORA_CUSTOMER_KEY),
        ("AGORA_CUSTOMER_SECRET", settings.AGORA_CUSTOMER_SECRET),
        ("TWILIO_ACCOUNT_SID", settings.TWILIO_ACCOUNT_SID),
        ("TWILIO_AUTH_TOKEN", settings.TWILIO_AUTH_TOKEN),
        ("TWILIO_PHONE_NUMBER", settings.TWILIO_PHONE_NUMBER),
        ("DEEPGRAM_API_KEY", settings.DEEPGRAM_API_KEY),
        ("OPENAI_API_KEY", settings.OPENAI_API_KEY),
        ("SUPABASE_URL", settings.SUPABASE_URL),
        ("SUPABASE_SERVICE_ROLE_KEY", settings.SUPABASE_SERVICE_ROLE_KEY),
        ("SLACK_WEBHOOK_URL", settings.SLACK_WEBHOOK_URL),
    ]

    missing_keys: List[str] = []
    for key, value in required_keys:
        val_str = str(value or "").strip()
        if not val_str or "your_" in val_str.lower() or val_str.startswith("https://your-project"):
            missing_keys.append(key)

    if missing_keys:
        error_msg = (
            "\n" + "=" * 80 + "\n"
            "CRITICAL CONFIGURATION ERROR: Missing or placeholder environment variables detected!\n"
            f"The following {len(missing_keys)} required environment variable(s) must be properly configured:\n"
            + "\n".join(f"  - {k}" for k in missing_keys)
            + "\n\nPlease populate your .env file according to .env.example before starting EchoSphere."
            + "\n" + "=" * 80 + "\n"
        )
        logger.critical(error_msg)
        if exit_on_failure:
            sys.stderr.write(error_msg + "\n")
            raise RuntimeError(f"Missing required configuration keys: {', '.join(missing_keys)}")
            
    logger.info("All required configuration keys verified successfully.")
    return missing_keys
