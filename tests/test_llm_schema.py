"""Unit tests for LLM schemas, Pydantic validation, and OpenAI 5 few-shot scenarios."""

import pytest
from app.models.llm_schemas import LLMExtractionResult
from app.services.openai_service import OpenAIService


@pytest.mark.asyncio
async def test_llm_schema_validation():
    """Test standard valid payload conforms strictly to LLMExtractionResult schema."""
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
    assert model.location == "NH-48"
    assert model.incident_type == "traffic_accident"


@pytest.mark.asyncio
async def test_llm_schema_never_invent_missing_data():
    """Verify that unspecified slots remain None and are not hallucinated."""
    data = {
        "reply": "How can I help you?",
        "incident_type": None,
        "location": None,
        "urgency": "LOW",
        "emergency": False,
        "extracted_slots": {},
        "llm_confidence": 0.85,
        "route": "automated",
    }
    model = LLMExtractionResult(**data)
    assert model.location is None
    assert model.incident_type is None
    assert model.extracted_slots == {}


@pytest.mark.asyncio
async def test_few_shot_1_routine():
    """Few-shot Example 1 (Routine): 'Sir office ka address kya hai?'."""
    service = OpenAIService()
    result = await service.extract_intent("Sir office ka address kya hai?")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is False
    assert result.route == "automated"
    assert result.incident_type == "inquiry"
    assert result.location is None  # Never invent missing data
    assert "Sector 62" in result.reply


@pytest.mark.asyncio
async def test_few_shot_2_accident():
    """Few-shot Example 2 (Accident): 'There is a major car accident on Main Street, two people are hurt.'."""
    service = OpenAIService()
    result = await service.extract_intent("There is a major car accident on Main Street, two people are hurt.")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is True
    assert result.route == "human_supervisor"
    assert result.incident_type == "traffic_accident"
    assert result.location == "Main Street"
    assert result.extracted_slots.get("injured_count") == 2


@pytest.mark.asyncio
async def test_few_shot_3_ambiguous():
    """Few-shot Example 3 (Ambiguous): 'Sir highway pe kuch problem hai.'."""
    service = OpenAIService()
    result = await service.extract_intent("Sir highway pe kuch problem hai.")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is False
    assert result.route == "human_supervisor"
    assert result.incident_type is None  # Not specified, do not invent
    assert result.location == "highway"
    assert result.llm_confidence <= 0.70


@pytest.mark.asyncio
async def test_few_shot_4_hinglish_accident():
    """Few-shot Example 4 (Hinglish Accident): 'Sir highway pe accident hua hai, ek banda injured hai.'."""
    service = OpenAIService()
    result = await service.extract_intent("Sir highway pe accident hua hai, ek banda injured hai.")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is True
    assert result.route == "human_supervisor"
    assert result.incident_type == "traffic_accident"
    assert result.location == "highway"


@pytest.mark.asyncio
async def test_few_shot_5_emergency():
    """Few-shot Example 5 (Emergency): 'Bachao! Building mein aag lag gayi hai, jaldi aao!'."""
    service = OpenAIService()
    result = await service.extract_intent("Bachao! Building mein aag lag gayi hai, jaldi aao!")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is True
    assert result.urgency == "CRITICAL"
    assert result.route == "human_supervisor"
    assert result.incident_type == "fire"
    assert result.location == "building"
    assert result.llm_confidence >= 0.95


@pytest.mark.asyncio
async def test_empty_transcript_handling():
    """Verify graceful handling for empty or whitespace transcript."""
    service = OpenAIService()
    result = await service.extract_intent("   ")
    assert isinstance(result, LLMExtractionResult)
    assert result.emergency is False
    assert result.route == "human_supervisor"
