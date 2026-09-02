"""OpenAI Service module with Structured Outputs and fallback mock adapter."""

import logging
from typing import Optional
from app.config import settings
from app.models.llm_schemas import LLMExtractionResult

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Battle Buddy, an intelligent emergency and assistance triage AI.
Analyze caller utterances in English or Hinglish.
Return structured JSON matching the provided schema.

Rules:
1. NEVER invent or hallucinate missing information. If location or incident type is not stated, set to null.
2. Support mixed Hindi-English (Hinglish) naturally.
3. Suggest route as 'human_supervisor' if high risk, ambiguous, or urgent, otherwise 'automated'.
4. Provide a helpful, calm reply in the caller's language.

Few-Shot Examples:

Example 1 (Routine):
Caller: "Sir office ka address kya hai?"
Result:
{
  "reply": "Hamara office Sector 62, Noida mein sthit hai. Kya aapko directions chahiye?",
  "incident_type": "inquiry",
  "location": null,
  "urgency": "LOW",
  "emergency": false,
  "extracted_slots": {"query_type": "address"},
  "llm_confidence": 0.95,
  "route": "automated"
}

Example 2 (Accident):
Caller: "There is a major car accident on Main Street, two people are hurt."
Result:
{
  "reply": "Emergency units are being alerted. Where exactly on Main Street are you located?",
  "incident_type": "traffic_accident",
  "location": "Main Street",
  "urgency": "HIGH",
  "emergency": true,
  "extracted_slots": {"injured_count": 2, "vehicles": "car"},
  "llm_confidence": 0.96,
  "route": "human_supervisor"
}

Example 3 (Ambiguous):
Caller: "Sir highway pe kuch problem hai."
Result:
{
  "reply": "Highway pe kya pareshani hai, kripya vistaar se batayein? Kya koi durghatna hui hai?",
  "incident_type": null,
  "location": "highway",
  "urgency": "MEDIUM",
  "emergency": false,
  "extracted_slots": {"area": "highway"},
  "llm_confidence": 0.65,
  "route": "human_supervisor"
}

Example 4 (Hinglish Accident):
Caller: "Sir highway pe accident hua hai, ek banda injured hai."
Result:
{
  "reply": "Ambulance aur patrol team ko alert kar diya gaya hai. Highway pe aapka exact point kaun sa hai?",
  "incident_type": "traffic_accident",
  "location": "highway",
  "urgency": "HIGH",
  "emergency": true,
  "extracted_slots": {"injured_count": 1, "road": "highway"},
  "llm_confidence": 0.94,
  "route": "human_supervisor"
}

Example 5 (Emergency):
Caller: "Bachao! Building mein aag lag gayi hai, jaldi aao!"
Result:
{
  "reply": "Fire services ko alert bhej diya gaya hai. Kripya building se turant bahar niklein aur safe doori banayein!",
  "incident_type": "fire",
  "location": "building",
  "urgency": "CRITICAL",
  "emergency": true,
  "extracted_slots": {"hazard": "fire"},
  "llm_confidence": 0.99,
  "route": "human_supervisor"
}
"""


class OpenAIService:
    """Service for interacting with OpenAI Structured Outputs."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self._async_client = None

        if self.api_key:
            try:
                from openai import AsyncOpenAI
                self._async_client = AsyncOpenAI(api_key=self.api_key)
            except ImportError:
                logger.warning("openai SDK not installed; falling back to mock adapter.")
            except Exception as e:
                logger.warning(f"Failed to initialize AsyncOpenAI client: {e}")

    async def extract_intent(self, transcript: str) -> LLMExtractionResult:
        """Extract structured incident data from transcript using OpenAI Structured Outputs or fallback adapter."""
        if not transcript or not transcript.strip():
            return LLMExtractionResult(
                reply="Hello, this is Battle Buddy. How can I assist you?",
                incident_type=None,
                location=None,
                urgency="LOW",
                emergency=False,
                extracted_slots={},
                llm_confidence=0.5,
                route="human_supervisor",
            )

        # Use live AsyncOpenAI client if configured
        if self._async_client:
            try:
                response = await self._async_client.beta.chat.completions.parse(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": transcript},
                    ],
                    response_format=LLMExtractionResult,
                )
                parsed = response.choices[0].message.parsed
                if parsed:
                    return parsed
            except Exception as exc:
                logger.error(f"OpenAI API request failed: {exc}. Falling back to adapter.")

        # Offline / Fallback Mock Adapter mirroring the 5 few-shot examples
        return self._mock_extract(transcript)

    def _mock_extract(self, transcript: str) -> LLMExtractionResult:
        """Deterministic adapter mirroring the 5 few-shot examples for testing and offline environments."""
        t_lower = transcript.lower()

        # 1. Few-shot Example 1: Routine
        if "address" in t_lower or "office" in t_lower:
            return LLMExtractionResult(
                reply="Hamara office Sector 62, Noida mein sthit hai. Kya aapko directions chahiye?",
                incident_type="inquiry",
                location=None,
                urgency="LOW",
                emergency=False,
                extracted_slots={"query_type": "address"},
                llm_confidence=0.95,
                route="automated",
            )

        # 2. Few-shot Example 2: Accident
        if "main street" in t_lower or ("accident" in t_lower and "hurt" in t_lower):
            return LLMExtractionResult(
                reply="Emergency units are being alerted. Where exactly on Main Street are you located?",
                incident_type="traffic_accident",
                location="Main Street" if "main street" in t_lower else None,
                urgency="HIGH",
                emergency=True,
                extracted_slots={"injured_count": 2 if "two" in t_lower or "2" in t_lower else 1, "vehicles": "car"},
                llm_confidence=0.96,
                route="human_supervisor",
            )

        # 3. Few-shot Example 3: Ambiguous
        if "kuch problem" in t_lower or "problem" in t_lower or "issue" in t_lower:
            return LLMExtractionResult(
                reply="Highway pe kya pareshani hai, kripya vistaar se batayein? Kya koi durghatna hui hai?",
                incident_type=None,
                location="highway" if "highway" in t_lower else None,
                urgency="MEDIUM",
                emergency=False,
                extracted_slots={"area": "highway"} if "highway" in t_lower else {},
                llm_confidence=0.65,
                route="human_supervisor",
            )

        # 4. Few-shot Example 4: Hinglish Accident
        if "accident" in t_lower and ("injured" in t_lower or "banda" in t_lower or "highway" in t_lower):
            return LLMExtractionResult(
                reply="Ambulance aur patrol team ko alert kar diya gaya hai. Highway pe aapka exact point kaun sa hai?",
                incident_type="traffic_accident",
                location="highway" if "highway" in t_lower else None,
                urgency="HIGH",
                emergency=True,
                extracted_slots={"injured_count": 1, "road": "highway"},
                llm_confidence=0.94,
                route="human_supervisor",
            )

        # 5. Few-shot Example 5: Emergency
        if "bachao" in t_lower or "aag" in t_lower or "fire" in t_lower or "danger" in t_lower:
            return LLMExtractionResult(
                reply="Fire services ko alert bhej diya gaya hai. Kripya building se turant bahar niklein aur safe doori banayein!",
                incident_type="fire",
                location="building" if "building" in t_lower else None,
                urgency="CRITICAL",
                emergency=True,
                extracted_slots={"hazard": "fire"},
                llm_confidence=0.99,
                route="human_supervisor",
            )

        # Default general fallback
        return LLMExtractionResult(
            reply="I have received your message. How can I assist you further?",
            incident_type="general",
            location=None,
            urgency="LOW",
            emergency=False,
            extracted_slots={},
            llm_confidence=0.85,
            route="automated",
        )
