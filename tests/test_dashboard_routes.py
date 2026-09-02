"""Tests for React WebSocket dashboard route and realtime events stream."""

import pytest
from fastapi.testclient import TestClient
from app.main import create_app


def test_dashboard_html_endpoints_served():
    """Verify GET / and GET /dashboard serve the React dashboard HTML with 200 OK."""
    app = create_app()
    client = TestClient(app)

    for route in ["/", "/dashboard"]:
        res = client.get(route)
        assert res.status_code == 200
        assert "text/html" in res.headers["content-type"]
        assert "Battle Buddy" in res.text
        assert "React" in res.text or "dashboard" in res.text.lower()
        assert "emergency-alert-banner" in res.text or "EMERGENCY ALERT" in res.text


def test_websocket_realtime_stream_without_polling():
    """Verify WebSocket /ws/events receives pipeline events in real time without polling:
    NEW_CALL, TRANSCRIPT_UPDATE, TRIAGE_UPDATE, EMERGENCY_ALERT,
    SUPERVISOR_CONNECTED, CALL_ENDED.
    """
    app = create_app()
    client = TestClient(app)

    with client.websocket_connect("/ws/events") as ws:
        # 1. Trigger incoming call -> emits CALL_STARTED / NEW_CALL
        res_voice = client.post(
            "/voice/incoming",
            data={"CallSid": "CA_DASH_LIVE", "From": "+112233", "To": "+998877"},
        )
        assert res_voice.status_code == 200

        # Receive NEW_CALL
        msg_call = ws.receive_json()
        assert msg_call["event_type"] == "CALL_STARTED"
        assert msg_call.get("event") == "NEW_CALL" or msg_call.get("event_alias") == "NEW_CALL"
        session_id = msg_call["session_id"]

        # 2. Trigger routine transcript processing -> emits TRANSCRIPT_UPDATE, INTENT_EXTRACTED, TRIAGE_UPDATE, TTS_READY
        res_routine = client.post(
            "/pipeline/process",
            json={
                "session_id": session_id,
                "transcript": "Sir office ka timing kya hai?",
                "stt_confidence": 0.95,
            },
        )
        assert res_routine.status_code == 200

        received_events = []
        for _ in range(4):
            received_events.append(ws.receive_json())

        event_types = [e["event_type"] for e in received_events]
        assert "TRANSCRIPT_RECEIVED" in event_types
        assert "INTENT_EXTRACTED" in event_types
        assert "TRIAGE_COMPLETED" in event_types
        assert "TTS_READY" in event_types

        # Check alias naming
        triage_msg = next(e for e in received_events if e["event_type"] == "TRIAGE_COMPLETED")
        assert triage_msg.get("event") == "TRIAGE_UPDATE" or triage_msg.get("event_alias") == "TRIAGE_UPDATE"

        # 3. Trigger emergency transcript -> emits EMERGENCY_ALERT / EMERGENCY_DETECTED
        res_emerg = client.post(
            "/pipeline/process",
            json={
                "session_id": session_id,
                "transcript": "Sir building mein fire lagi hai aur log injured hain bachao!",
                "stt_confidence": 0.94,
            },
        )
        assert res_emerg.status_code == 200

        emerg_events = []
        for _ in range(4):  # TRANSCRIPT_RECEIVED, INTENT_EXTRACTED, TRIAGE_COMPLETED, EMERGENCY_DETECTED
            emerg_events.append(ws.receive_json())

        emerg_types = [e["event_type"] for e in emerg_events]
        assert "EMERGENCY_DETECTED" in emerg_types
        emerg_msg = next(e for e in emerg_events if e["event_type"] == "EMERGENCY_DETECTED")
        assert emerg_msg.get("event") == "EMERGENCY_ALERT" or emerg_msg.get("event_alias") == "EMERGENCY_ALERT"
        assert emerg_msg["payload"]["priority"] in ["HIGH", "CRITICAL"]

        # 4. Trigger supervisor takeover -> emits SUPERVISOR_CONNECTED
        res_override = client.post(
            "/supervisor/override",
            json={"session_id": session_id, "reason": "Supervisor stepping in"},
        )
        assert res_override.status_code == 200

        msg_sup = ws.receive_json()
        assert msg_sup["event_type"] == "SUPERVISOR_CONNECTED"
        assert msg_sup["payload"]["tts_halted"] is True

        # 5. Trigger call ended -> emits CALL_ENDED
        res_status = client.post(
            "/voice/status",
            data={"CallSid": "CA_DASH_LIVE", "CallStatus": "completed"},
        )
        assert res_status.status_code == 200

        msg_end = ws.receive_json()
        assert msg_end["event_type"] == "CALL_ENDED"
        assert msg_end["payload"]["status"] == "COMPLETED"
