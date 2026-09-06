"""RESCURO OpenAI Service Shim.
Re-exports openai_service and OpenAIService from app.services.openai_service.
"""
from app.services.openai_service import (
    OpenAIService,
    LLMExtractionResult,
    SlotExtractionResult,
    openai_service,
    EMERGENCY_KEYWORDS,
)

__all__ = [
    "OpenAIService",
    "LLMExtractionResult",
    "SlotExtractionResult",
    "openai_service",
    "EMERGENCY_KEYWORDS",
]
