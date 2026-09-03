import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
try:
    from openai import AsyncOpenAI
except ImportError:
    AsyncOpenAI = None
from config import settings


logger = logging.getLogger("echosphere.openai")

# Deterministic safety keywords triggering immediate emergency escalation
# Covers Hindi, English, and transliterated Hinglish distress terminology
EMERGENCY_KEYWORDS = [
    "emergency", "accident", "help", "bachao", "khatra", "mar gaya",
    "ambulance", "police", "aag", "fire", "danger", "critical",
    "blood", "hospital", "chot", "khoon", "madad", "heart attack",
    "stroke", "behosh", "unconscious", "suicide", "murder", "threat"
]

SYSTEM_PROMPT = """You are EchoSphere's core conversational intelligence and information extraction engine for a multilingual (Hindi, English, Hinglish) citizen helpline in India.

Your mission:
1. Analyze the transcript turns so far between the caller and the system.
2. Extract the structured slots:
   - caller_name: (e.g. 'Rahul Sharma', or null if not yet provided)
   - location: (e.g. 'Sector 18 Noida', 'Bandra West, near station', or null)
   - issue: (concise statement of their grievance, emergency, query, or report)
   - language_detected: ('Hindi', 'English', 'Hinglish')
   - missing_slots: Array of missing required slots among ['caller_name', 'location', 'issue']
   - llm_confidence: Float from 0.00 to 1.00 indicating your confidence in having accurately extracted the information.
   - safety_flag: Boolean, true if caller expresses distress, medical danger, physical threat, or immediate hazard.
   - conversational_reply: A warm, respectful, natural spoken response in the same code-switched language (Hindi/Hinglish/English) acknowledging what they said and reassuring them.
   - next_question: The single most important clarifying question to ask to obtain the highest priority missing slot (in Hindi/English), or null if all slots are filled.

CRITICAL RULES:
- You MUST ALWAYS respond with valid, structured JSON strictly adhering to the JSON schema.
- NEVER output Markdown blocks (no ```json ... ```), no conversational banter outside the JSON.
- If the caller speaks Hindi or Hinglish, conversational_reply and next_question MUST be in natural, polite Hindi/Hinglish (e.g. 'नमस्ते! आपकी क्या सहायता कर सकता हूँ?').
"""

class SlotSchema(BaseModel):
    caller_name: Optional[str] = Field(default=None, description="Name of the caller if mentioned")
    location: Optional[str] = Field(default=None, description="Geographic location, landmark, or address")
    issue: Optional[str] = Field(default=None, description="Core issue or request description")
    language_detected: str = Field(default="Hinglish", description="Detected language: Hindi, English, or Hinglish")
    missing_slots: List[str] = Field(default_factory=lambda: ["caller_name", "location", "issue"])
    confidence: float = Field(default=0.85, ge=0.0, le=1.0, description="LLM semantic confidence score")
    next_question: Optional[str] = Field(default=None, description="Next prompt to elicit missing information")
    conversational_reply: str = Field(default="", description="Spoken reply to the caller")
    safety_flag: bool = Field(default=False, description="Emergency or danger flag")


class SlotExtractionResult(BaseModel):
    caller_name: Optional[str]
    location: Optional[str]
    issue: Optional[str]
    language_detected: str
    missing_slots: List[str]
    llm_confidence: float
    combined_confidence: float
    next_question: Optional[str]
    conversational_reply: str
    safety_flag: bool
    safety_trigger: Optional[str] = None
    should_escalate: bool
    escalation_reason: Optional[str] = None


class OpenAIService:
    """
    Manages structured slot extraction and safety verification via OpenAI gpt-4o-mini.
    """
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY.strip()
        self.client: Optional[AsyncOpenAI] = None
        if self.api_key and not self.api_key.startswith("your_"):
            self.client = AsyncOpenAI(api_key=self.api_key)
        else:
            logger.warning("OpenAI API key not configured; mock structured responses will be used.")

    def _check_deterministic_keywords(self, transcript_text: str) -> Optional[str]:
        """
        Runs a zero-latency deterministic keyword scan on the lowercased transcript.
        Returns the matched keyword if an emergency term is present, else None.
        """
        text_lower = transcript_text.lower()
        for kw in EMERGENCY_KEYWORDS:
            # Check for word boundaries or presence
            if kw in text_lower:
                return kw
        return None

    async def extract_slots(
        self,
        transcript_so_far: str,
        deepgram_confidence: float = 1.0
    ) -> SlotExtractionResult:
        """
        Calls gpt-4o-mini to extract structured information, computes the canonical combined
        confidence score, and applies deterministic keyword safety overrides.
        
        CONFIDENCE MERGE FORMULA:
        -------------------------
        combined_confidence = round((0.40 * deepgram_confidence) + (0.60 * llm_confidence), 3)
        
        Rationale:
        1. Deepgram Nova-2 provides an acoustic/phonetic speech-to-text accuracy confidence (40% weight).
        2. OpenAI gpt-4o-mini evaluates semantic consistency, syntactic completeness, and slot clarity (60% weight).
        3. If either acoustic STT or LLM semantic comprehension degrades severely, the combined score drops
           below CONFIDENCE_ESCALATION_THRESHOLD (0.65), safely routing the call to a human supervisor.
           
        SAFETY OVERRIDE RULE:
        ---------------------
        If ANY term from EMERGENCY_KEYWORDS (e.g. 'bachao', 'accident', 'help', 'khatra') is detected in
        the transcript, safety_flag is set to True, triggering IMMEDIATE escalation regardless of confidence score.
        """
        threshold = settings.CONFIDENCE_ESCALATION_THRESHOLD
        keyword_match = self._check_deterministic_keywords(transcript_so_far)

        # Fallback if OpenAI client is unconfigured or in offline test mode
        if not self.client:
            llm_conf = 0.85
            combined_conf = round((0.40 * deepgram_confidence) + (0.60 * llm_conf), 3)
            safety_flag = bool(keyword_match)
            should_escalate = (combined_conf < threshold) or safety_flag
            escalation_reason = None
            if safety_flag:
                escalation_reason = f"Emergency safety keyword detected: '{keyword_match}'"
            elif combined_conf < threshold:
                escalation_reason = f"Combined confidence {combined_conf:.2f} fell below threshold {threshold:.2f}"

            return SlotExtractionResult(
                caller_name="Rahul",
                location="Sector 62, Noida",
                issue="Water supply disruption",
                language_detected="Hinglish",
                missing_slots=[],
                llm_confidence=llm_conf,
                combined_confidence=combined_conf,
                next_question=None,
                conversational_reply="नमस्ते राहुल जी, हमने सेक्टर 62 नोएडा में पानी की समस्या का विवरण दर्ज कर लिया है।",
                safety_flag=safety_flag,
                safety_trigger=keyword_match,
                should_escalate=should_escalate,
                escalation_reason=escalation_reason
            )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Transcript turns so far:\n\n{transcript_so_far}\n\nPlease extract structured slots in JSON format."
            }
        ]

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.1
            )

            raw_content = response.choices[0].message.content or "{}"
            parsed = json.loads(raw_content)

            # Map into SlotSchema for type validation
            llm_conf = float(parsed.get("confidence", parsed.get("llm_confidence", 0.80)))
            # Clamp LLM confidence between 0.0 and 1.0
            llm_conf = max(0.0, min(1.0, llm_conf))

            # Apply Canonical Confidence Merge Formula
            combined_conf = round((0.40 * deepgram_confidence) + (0.60 * llm_conf), 3)

            # Evaluate Safety Flag & Deterministic Keyword Override
            model_safety = bool(parsed.get("safety_flag", False))
            safety_flag = model_safety or bool(keyword_match)
            safety_trigger = keyword_match if keyword_match else ("model_safety_flag" if model_safety else None)

            # Escalation Evaluation
            should_escalate = False
            escalation_reason = None

            if safety_flag:
                should_escalate = True
                escalation_reason = f"Emergency safety override: '{safety_trigger}' detected."
            elif combined_conf < threshold:
                should_escalate = True
                escalation_reason = f"Combined confidence {combined_conf:.2f} is below threshold {threshold:.2f}."

            caller_name = parsed.get("caller_name")
            location = parsed.get("location")
            issue = parsed.get("issue")

            # Derive missing slots if model missed any
            missing = parsed.get("missing_slots", [])
            if not isinstance(missing, list):
                missing = []
            if not caller_name and "caller_name" not in missing:
                missing.append("caller_name")
            if not location and "location" not in missing:
                missing.append("location")
            if not issue and "issue" not in missing:
                missing.append("issue")

            result = SlotExtractionResult(
                caller_name=caller_name,
                location=location,
                issue=issue,
                language_detected=parsed.get("language_detected", "Hinglish"),
                missing_slots=missing,
                llm_confidence=llm_conf,
                combined_confidence=combined_conf,
                next_question=parsed.get("next_question"),
                conversational_reply=parsed.get("conversational_reply", "आपकी बात समझ ली गई है। Please go ahead."),
                safety_flag=safety_flag,
                safety_trigger=safety_trigger,
                should_escalate=should_escalate,
                escalation_reason=escalation_reason
            )

            logger.info(
                "Slot extraction finished. Combined conf: %.3f (DG: %.3f, LLM: %.3f), Escalate: %s (%s)",
                combined_conf, deepgram_confidence, llm_conf, should_escalate, escalation_reason
            )
            return result

        except Exception as exc:
            logger.error("Error during OpenAI slot extraction: %s", exc)
            # Safe failover on error: trigger escalation
            combined_conf = round(0.40 * deepgram_confidence, 3)
            return SlotExtractionResult(
                caller_name=None,
                location=None,
                issue="Extraction error occurred during processing",
                language_detected="undetermined",
                missing_slots=["caller_name", "location", "issue"],
                llm_confidence=0.0,
                combined_confidence=combined_conf,
                next_question="क्या आप अपनी समस्या फिर से बता सकते हैं?",
                conversational_reply="क्षमा करें, समझने में थोड़ी परेशानी हुई। मैं आपको एक सुपरवाइजर से कनेक्ट कर रहा हूँ।",
                safety_flag=True,
                safety_trigger="openai_processing_exception",
                should_escalate=True,
                escalation_reason=f"OpenAI service processing error: {exc}"
            )


# Singleton service instance
openai_service = OpenAIService()
