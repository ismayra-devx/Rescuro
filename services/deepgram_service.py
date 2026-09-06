"""RESCURO Deepgram Service Shim.
Re-exports deepgram_service and DeepgramService from app.services.deepgram_service.
"""
from app.services.deepgram_service import (
    DeepgramService,
    TranscriptChunk,
    deepgram_service,
    EMERGENCY_KEYWORDS,
    BOOSTED_KEYWORDS,
    DEFAULT_KEYWORD_BOOSTS,
)

__all__ = [
    "DeepgramService",
    "TranscriptChunk",
    "deepgram_service",
    "EMERGENCY_KEYWORDS",
    "BOOSTED_KEYWORDS",
    "DEFAULT_KEYWORD_BOOSTS",
]
