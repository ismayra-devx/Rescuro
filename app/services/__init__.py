"""Services package exposing vendor integrations and core audio interfaces."""

from app.services.agora_service import (
    AgoraAudioAdapter,
    AgoraConfigurationError,
    AgoraError,
    AgoraSDKError,
)
from app.services.audio_adapter import (
    AudioAdapter,
    BaseAudioAdapter,
    MockAudioAdapter,
    RecordedAudioAdapter,
    get_audio_adapter,
)
from app.services.openai_service import OpenAIService
from app.services.supabase_service import SupabaseService
from app.services.triage_service import (
    HIGH_RISK_KEYWORDS,
    TriageResult,
    deterministic_triage,
    normalize_text,
)
from app.services.tts_service import TTSService
from app.services.twilio_service import TwilioService
from app.services.deepgram_service import DeepgramService, deepgram_service
from app.services.slack_service import SlackService, slack_service

__all__ = [
    "BaseAudioAdapter",
    "AudioAdapter",
    "MockAudioAdapter",
    "RecordedAudioAdapter",
    "AgoraAudioAdapter",
    "AgoraError",
    "AgoraConfigurationError",
    "AgoraSDKError",
    "get_audio_adapter",
    "OpenAIService",
    "SupabaseService",
    "TTSService",
    "TwilioService",
    "TriageResult",
    "deterministic_triage",
    "normalize_text",
    "HIGH_RISK_KEYWORDS",
    "DeepgramService",
    "deepgram_service",
    "SlackService",
    "slack_service",
]
