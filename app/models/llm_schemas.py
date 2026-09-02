"""Pydantic schemas for LLM structured output extraction."""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class LLMExtractionResult(BaseModel):
    """Structured extraction output from LLM."""

    reply: str = Field(
        ...,
        description="The conversational response back to the caller in English or Hinglish.",
    )
    incident_type: Optional[str] = Field(
        default=None,
        description="Type of incident (e.g., 'traffic_accident', 'fire', 'medical', 'inquiry', or None). Never invent data.",
    )
    location: Optional[str] = Field(
        default=None,
        description="Location extracted from caller utterance, or None if unspecified. Never invent data.",
    )
    urgency: str = Field(
        default="LOW",
        description="Assessed urgency level: 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'.",
    )
    emergency: bool = Field(
        default=False,
        description="True if an acute life, safety, or property danger is detected.",
    )
    extracted_slots: Dict[str, Any] = Field(
        default_factory=dict,
        description="Key-value pairs of extracted entities. Only include mentioned information.",
    )
    llm_confidence: float = Field(
        default=0.9,
        ge=0.0,
        le=1.0,
        description="Model confidence score between 0.0 and 1.0.",
    )
    route: str = Field(
        default="automated",
        description="Proposed routing from LLM interpretation ('automated' or 'human_supervisor').",
    )
