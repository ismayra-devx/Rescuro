"""Unit tests for deterministic triage function and keyword checks."""

import pytest
from app.services.triage_service import (
    deterministic_triage,
    find_high_risk_keywords,
    normalize_text,
)


def test_triage_boundary_0_80():
    """Boundary test: STT=0.80, LLM=0.80 -> combined=0.80 -> human_supervisor."""
    result = deterministic_triage(
        stt_confidence=0.80,
        llm_confidence=0.80,
        emergency=False,
        transcript="Normal routine message asking about timing",
    )
    assert result.combined_confidence == 0.80
    assert result.route == "human_supervisor"
    assert "does not exceed automated threshold" in result.reason


def test_triage_boundary_0_81():
    """Boundary test: STT=0.81, LLM=0.81 -> combined=0.81 -> automated."""
    result = deterministic_triage(
        stt_confidence=0.81,
        llm_confidence=0.81,
        emergency=False,
        transcript="Routine inquiry about office timing",
    )
    assert result.combined_confidence == 0.81
    assert result.route == "automated"
    assert result.priority == "NORMAL"


def test_triage_low_stt():
    """Low STT test: STT=0.55, LLM=0.70 -> combined=0.625 -> human_supervisor."""
    result = deterministic_triage(
        stt_confidence=0.55,
        llm_confidence=0.70,
        emergency=False,
        transcript="Some unclear audio",
    )
    assert result.combined_confidence == 0.625
    assert result.route == "human_supervisor"


def test_triage_low_llm():
    """Low LLM test: STT=0.90, LLM=0.60 -> combined=0.75 -> human_supervisor."""
    result = deterministic_triage(
        stt_confidence=0.90,
        llm_confidence=0.60,
        emergency=False,
        transcript="Clear audio but ambiguous message",
    )
    assert result.combined_confidence == 0.75
    assert result.route == "human_supervisor"


def test_triage_emergency_keyword_override():
    """Keyword override: High confidence (LLM=0.98, STT=0.98) but transcript has 'bachao' -> human_supervisor."""
    result = deterministic_triage(
        stt_confidence=0.98,
        llm_confidence=0.98,
        emergency=False,
        transcript="Kripya jaldi bachao mujhe!",
    )
    assert result.route == "human_supervisor"
    assert "bachao" in result.matched_keywords
    assert result.priority == "HIGH"


def test_triage_explicit_emergency_flag():
    """Explicit emergency flag -> human_supervisor with CRITICAL priority."""
    result = deterministic_triage(
        stt_confidence=0.95,
        llm_confidence=0.95,
        emergency=True,
        transcript="Building mein aag lag gayi hai",
    )
    assert result.route == "human_supervisor"
    assert result.priority == "CRITICAL"


def test_normalize_text_and_keyword_variations():
    """Verify case, spacing, and punctuation normalization."""
    raw = "   FIRE!!!   Please send HELP now...   "
    normalized = normalize_text(raw)
    assert normalized == "fire please send help now"

    keywords = find_high_risk_keywords(normalized)
    assert "fire" in keywords
    assert "help" in keywords


@pytest.mark.parametrize(
    "keyword",
    [
        "emergency",
        "accident",
        "help",
        "bachao",
        "khatra",
        "fire",
        "bleeding",
        "injured",
        "hurt",
        "danger",
        "attack",
        "crash",
    ],
)
def test_all_12_high_risk_keywords_trigger_human_supervisor(keyword):
    """Verify that every single high-risk keyword forces human_supervisor even with 1.0 confidence."""
    text = f"Caller says there is a {keyword} right now."
    result = deterministic_triage(
        stt_confidence=1.0,
        llm_confidence=1.0,
        emergency=False,
        transcript=text,
    )
    assert result.route == "human_supervisor"
    assert result.priority == "HIGH"
    assert keyword in result.matched_keywords
    assert f"High-risk keyword(s) detected: {keyword}" in result.reason
