"""Unit tests for LLM schemas and OpenAI structured output handling."""

import pytest
from app.models.llm_schemas import LLMExtractionResult
from app.services.openai_service import OpenAIService


@pytest.mark.asyncio
async def test_llm_schema_validation():
    """Test standard valid payload conforms to LLMExtractionResult schema."""
    data = {
        "reply": "Main aapki sahayata kar raha hoon.",
        "incident_type": "traffic_accident",
        "location": "NH-48",
        "urgency": "HIGH",
        "emergency": True,
        "extracted_slots": {"road": "NH-48"},
        "llm_confidence": 0.92,
        "route": "human_supervisor",
    }
    model = LLMExtractionResult(**data)
    assert model.reply == "Main aapki sahayata kar raha hoon."
    assert model.emergency is True
    assert model.urgency == "HIGH"
    assert model.route == "human_supervisor"


@pytest.mark.asyncio
async def test_openai_service_few_shot_routine():
    """Verify routine inquiry returns expected schema and fields."""
    service = OpenAIService()
    result = await service.extract_intent("Sir office ka address kya hai?")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is False
    assert result.route == "automated"
    assert "Sector 62" in result.reply or "address" in str(result.extracted_slots)


@pytest.mark.asyncio
async def test_openai_service_few_shot_hinglish_accident():
    """Verify Hinglish accident extraction."""
    service = OpenAIService()
    result = await service.extract_intent("Sir highway pe accident hua hai, ek banda injured hai.")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is True
    assert result.route == "human_supervisor"
    assert result.incident_type == "traffic_accident"


@pytest.mark.asyncio
async def test_openai_service_empty_input():
    """Verify graceful handling for empty utterance."""
    service = OpenAIService()
    result = await service.extract_intent("")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is False
