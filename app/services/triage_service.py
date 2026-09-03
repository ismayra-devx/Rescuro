"""Deterministic triage and safety routing service."""

import re
from typing import List, Optional
from pydantic import BaseModel, Field


HIGH_RISK_KEYWORDS = [
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
]


class TriageResult(BaseModel):
    """Result of deterministic triage."""

    route: str = Field(..., description="'automated' or 'human_supervisor'")
    priority: str = Field(..., description="'NORMAL', 'MEDIUM', 'HIGH', or 'CRITICAL'")
    reason: str = Field(..., description="Explicit reason for routing decision")
    combined_confidence: float = Field(..., description="0.5*stt_confidence + 0.5*llm_confidence")
    matched_keywords: List[str] = Field(default_factory=list)


def normalize_text(text: Optional[str]) -> str:
    """Normalize text by lowering case, removing punctuation, and collapsing whitespace."""
    if not text:
        return ""
    # Replace non-alphanumeric with spaces, keep unicode/alphanumerics
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())


def find_high_risk_keywords(normalized_text: str) -> List[str]:
    """Find any occurrence of high-risk keywords in normalized text."""
    if not normalized_text:
        return []
    words = set(normalized_text.split())
    matches = [kw for kw in HIGH_RISK_KEYWORDS if kw in words or re.search(r"\b" + re.escape(kw) + r"\b", normalized_text)]
    return sorted(list(set(matches)))


def deterministic_triage(
    stt_confidence: float,
    llm_confidence: float,
    emergency: bool,
    transcript: Optional[str] = "",
) -> TriageResult:
    """Pure deterministic triage decision.
    
    Formula: combined_confidence = 0.5 * stt_confidence + 0.5 * llm_confidence.
    Rules:
      1. If emergency == True -> human_supervisor
      2. Else if any high-risk keyword -> human_supervisor
      3. Else if combined_confidence > 0.8 -> automated
      4. Else -> human_supervisor
    """
    # Clamp confidence values
    stt = max(0.0, min(1.0, float(stt_confidence)))
    llm = max(0.0, min(1.0, float(llm_confidence)))
    combined = round((0.5 * stt) + (0.5 * llm), 4)

    normalized = normalize_text(transcript)
    matched_kws = find_high_risk_keywords(normalized)

    # Rule 1: Explicit emergency
    if emergency:
        return TriageResult(
            route="human_supervisor",
            priority="CRITICAL",
            reason="Emergency flag triggered by analyzer",
            combined_confidence=combined,
            matched_keywords=matched_kws,
        )

    # Rule 2: High-risk keywords
    if matched_kws:
        return TriageResult(
            route="human_supervisor",
            priority="HIGH",
            reason=f"High-risk keyword(s) detected: {', '.join(matched_kws)}",
            combined_confidence=combined,
            matched_keywords=matched_kws,
        )

    # Rule 3: Confident automated routing (> 0.8 strict threshold)
    if combined > 0.80:
        return TriageResult(
            route="automated",
            priority="NORMAL",
            reason=f"Combined confidence {combined:.3f} exceeds automated threshold (0.80)",
            combined_confidence=combined,
            matched_keywords=[],
        )

    # Rule 4: Low / boundary confidence fallback
    return TriageResult(
        route="human_supervisor",
        priority="MEDIUM",
        reason=f"Combined confidence {combined:.3f} does not exceed automated threshold (0.80)",
        combined_confidence=combined,
        matched_keywords=[],
    )
