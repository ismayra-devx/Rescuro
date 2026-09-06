"""Tests for RESCURO Consent Gate:
- Evaluates natural affirmative ("yes", "haan", "I agree", "proceed") -> True
- Evaluates natural negative ("no", "nahin", "don't agree", "don't record") -> False
- Evaluates ambiguous/emergency statements ("Accident ho gaya", "Who is this?") -> None
- Verifies CallSession consent fields and states (AWAITING_CONSENT, CONSENT_DENIED)
- Verifies exact initial consent greeting disclosure
"""

import pytest
from app.models.session import CallSession, SessionStatus
from app.services.openai_service import evaluate_consent_response
from app.services.pipeline import evaluate_consent
from app.api.exotel import CONSENT_GREETING_TEXT


def test_consent_affirmative_responses():
    """Verify that varied English, Hindi, and Hinglish affirmations grant consent."""
    affirmative_examples = [
        "yes",
        "YES",
        "Yeah",
        "yep",
        "sure",
        "I consent",
        "I agree",
        "okay",
        "ok",
        "please proceed",
        "go ahead",
        "haan",
        "haanji",
        "ji haan",
        "theek hai",
        "bilkul",
        "sahi hai",
        "yes I agree to continue",
        "haan theek hai bolo",
        "okay proceed",
        "I agree to record"
    ]
    for text in affirmative_examples:
        res = evaluate_consent_response(text)
        assert res is True, f"Expected '{text}' to evaluate to True, got {res}"
        pipeline_res = evaluate_consent(text)
        assert pipeline_res is True, f"Pipeline evaluate_consent failed for '{text}'"


def test_consent_negative_responses():
    """Verify that varied English, Hindi, and Hinglish refusals deny consent."""
    negative_examples = [
        "no",
        "NO",
        "nope",
        "nah",
        "I do not consent",
        "do not record",
        "don't record me",
        "I don't agree",
        "disagree",
        "cancel",
        "stop",
        "nahin",
        "nahi",
        "mat karo",
        "record mat karo",
        "no I don't consent",
        "nahin mujhe record nahi hona"
    ]
    for text in negative_examples:
        res = evaluate_consent_response(text)
        assert res is False, f"Expected '{text}' to evaluate to False, got {res}"
        pipeline_res = evaluate_consent(text)
        assert pipeline_res is False, f"Pipeline evaluate_consent failed for '{text}'"


def test_consent_ambiguous_and_emergency_blurt_responses():
    """Verify that blurting emergency info before consenting does not accidentally grant consent."""
    ambiguous_examples = [
        "Accident ho gaya hai metro station ke paas!",
        "Emergency! Please send an ambulance!",
        "Khoon nikal raha hai jaldi aao!",
        "Who is speaking?",
        "Aap kaun bol rahe ho?",
        "What do you mean?",
        "Kya bola aapne?",
        "Hello hello?"
    ]
    for text in ambiguous_examples:
        res = evaluate_consent_response(text)
        assert res is None, f"Expected '{text}' to evaluate to None (ambiguous/unconfirmed), got {res}"


def test_call_session_consent_fields():
    """Verify CallSession model tracks consent state and status enum."""
    session = CallSession(
        session_id="test_sess_001",
        call_sid="call_sid_123",
        status=SessionStatus.AWAITING_CONSENT
    )
    assert session.status == SessionStatus.AWAITING_CONSENT
    assert session.consent_granted is None
    assert session.supervisor_requested is False

    # Grant consent
    session.consent_granted = True
    session.status = SessionStatus.ACTIVE
    assert session.consent_granted is True
    assert session.status == SessionStatus.ACTIVE

    # Deny consent
    denied_session = CallSession(
        session_id="test_sess_002",
        call_sid="call_sid_456",
        status=SessionStatus.CONSENT_DENIED,
        consent_granted=False
    )
    assert denied_session.status == SessionStatus.CONSENT_DENIED
    assert denied_session.consent_granted is False


def test_consent_greeting_content():
    """Verify required exact disclosure elements in initial consent greeting."""
    assert "RESCURO Emergency Response" in CONSENT_GREETING_TEXT
    assert "recorded for emergency response" in CONSENT_GREETING_TEXT
    assert "Do you consent to continue?" in CONSENT_GREETING_TEXT
