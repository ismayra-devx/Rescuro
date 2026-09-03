import os
import sys
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from main import app, format_dashboard_payload
from services.openai_service import openai_service, EMERGENCY_KEYWORDS
from services.agora_service import agora_service
from services.slack_service import slack_service
from services.twilio_service import twilio_service

client = TestClient(app)

def test_health_endpoint():
    """Verify /health returns 200 with diagnostics status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "escalation_threshold" in data
    assert data["escalation_threshold"] == 0.65
    print("[PASS] /health test passed")

def test_voice_incoming_twiml():
    """Verify /voice/incoming generates valid TwiML XML with Agora/WebSocket Stream."""
    payload = {
        "CallSid": "CA1234567890abcdef1234567890abcdef",
        "From": "+919876543210",
        "To": "+1800123456"
    }
    response = client.post("/voice/incoming", data=payload)
    assert response.status_code == 200
    assert "application/xml" in response.headers["content-type"]
    text = response.text
    assert "<Response>" in text
    assert "<Connect>" in text
    assert "<Stream" in text
    assert "session_id" in text
    assert "channel_name" in text
    print("[PASS] /voice/incoming TwiML test passed")

def test_voice_status_callback():
    """Verify /voice/status handles status transitions gracefully."""
    payload = {
        "CallSid": "CA1234567890abcdef1234567890abcdef",
        "CallStatus": "completed"
    }
    response = client.post("/voice/status", data=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "received"]
    assert data["call_status"] == "completed"

    print("[PASS] /voice/status test passed")

def test_call_transcript_ingest_and_optimistic_ticketing():
    """Verify /call/transcript performs slot extraction, returns conversational reply and optimistic ticket ID."""
    payload = {
        "session_id": "test-session-1234",
        "speaker": "caller",
        "text": "मेरा नाम राहुल है, सेक्टर 62 नोएडा में पानी नहीं आ रहा है।",
        "language": "hi-en",
        "deepgram_confidence": 0.92
    }
    response = client.post("/call/transcript", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "ticket_id" in data
    assert data["ticket_id"].startswith("TKT-")
    assert "confidence" in data
    assert "conversational_reply" in data
    print("[PASS] /call/transcript optimistic ticketing test passed")

def test_deterministic_emergency_keyword_override():
    """Verify emergency keywords like 'bachao', 'accident', 'emergency' force safety_flag=True and escalation."""
    for kw in ["emergency", "accident", "bachao", "khatra", "ambulance"]:
        assert kw in EMERGENCY_KEYWORDS
        matched = openai_service._check_deterministic_keywords(f"कृपया मदद करें, यहाँ {kw} हो गया है!")
        assert matched == kw, f"Keyword {kw} failed to match"
    print("[PASS] Deterministic emergency keywords scan passed")

def test_combined_confidence_formula_and_safety_flag():
    """Verify combined confidence calculation and threshold decision."""
    # Run async slot extraction check directly
    result = asyncio.run(
        openai_service.extract_slots(
            transcript_so_far="यहाँ बहुत बड़ा accident हुआ है, तुरंत मदद चाहिए!",
            deepgram_confidence=0.95
        )
    )
    # Even with 0.95 Deepgram confidence, emergency keyword must force safety_flag and escalation
    assert result.safety_flag is True
    assert result.should_escalate is True
    assert "accident" in (result.safety_trigger or "")
    print("[PASS] Emergency keyword safety override verified")

def test_agora_rtc_token_generation():
    """Verify Agora RTC token generation returns valid token format."""
    token = agora_service.generate_rtc_token("test_channel_123", uid=1001, role=1, expire_seconds=3600)
    assert isinstance(token, str)
    assert len(token) > 10
    print("[PASS] Agora RTC token generation test passed")

def test_slack_block_kit_builder():
    """Verify Slack Block Kit payload formats properly."""
    context = {
        "session_id": "sess-abc-123",
        "ticket_id": "TKT-TEST1",
        "caller_name": "Priya Sharma",
        "caller_phone": "+919811122233",
        "location": "Connaught Place, New Delhi",
        "issue": "Road blockage and traffic light failure",
        "language": "Hinglish",
        "combined_confidence": 0.55,
        "confidence_threshold": 0.65,
        "escalation_reason": "Low confidence score",
        "safety_flag": False,
        "channel_name": "echosphere_sess123"
    }
    payload = slack_service._build_block_kit_payload(context)
    assert "blocks" in payload
    assert len(payload["blocks"]) >= 5
    assert payload["blocks"][0]["type"] == "header"
    print("[PASS] Slack Block Kit builder test passed")

def test_dashboard_payload_hook():
    """Verify format_dashboard_payload hook produces expected frontend event contract."""
    event = format_dashboard_payload(
        session_id="sess-001",
        event_type="slots_updated",
        data={"caller_name": "Aman", "issue": "Power outage"},
        channel_name="echosphere_sess001"
    )
    assert event["eventType"] == "slots_updated"
    assert event["sessionId"] == "sess-001"
    assert event["channelName"] == "echosphere_sess001"
    assert event["payload"]["caller_name"] == "Aman"
    print("[PASS] Dashboard sync payload hook test passed")

if __name__ == "__main__":
    test_health_endpoint()
    test_voice_incoming_twiml()
    test_voice_status_callback()
    test_call_transcript_ingest_and_optimistic_ticketing()
    test_deterministic_emergency_keyword_override()
    test_combined_confidence_formula_and_safety_flag()
    test_agora_rtc_token_generation()
    test_slack_block_kit_builder()
    test_dashboard_payload_hook()
    print("\n==================================================")
    print("ALL 9 TEST SUITES COMPLETED AND PASSED!")
    print("==================================================")

