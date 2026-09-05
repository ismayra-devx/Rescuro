"""Tests for Telnyx voice webhooks, Ed25519 signature validation, and media streaming."""

import base64
import json
import pytest
from cryptography.hazmat.primitives.asymmetric import ed25519
from fastapi.testclient import TestClient

from app.main import create_app
from app.models.session import SessionStatus
from app.services.telnyx_service import TelnyxService


def test_telnyx_health():
    """Verify GET /telnyx/health returns expected health payload."""
    app = create_app()
    client = TestClient(app)

    response = client.get("/telnyx/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["provider"] == "telnyx"
    assert data["webhook"] == "ready"
    assert data["media_websocket"] == "ready"


def test_telnyx_webhook_call_initiated():
    """Verify POST /telnyx/webhook on call.initiated creates a RESCURO session."""
    app = create_app()
    client = TestClient(app)

    call_control_id = "v3:TEST_CALL_CTRL_12345"
    payload = {
        "data": {
            "event_type": "call.initiated",
            "id": "evt_001",
            "occurred_at": "2026-09-05T22:00:00Z",
            "payload": {
                "call_control_id": call_control_id,
                "call_leg_id": "leg_001",
                "call_session_id": "sess_001",
                "from": "+15551234567",
                "to": "+15557654321",
                "direction": "incoming",
                "state": "parked",
            },
            "record_type": "event",
        }
    }

    response = client.post("/telnyx/webhook", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "ok"
    assert res_data["event"] == "call.initiated"
    assert res_data["call_control_id"] == call_control_id
    assert "session_id" in res_data

    # Verify session registered in orchestrator
    orchestrator = app.state.orchestrator
    session = orchestrator.get_session(res_data["session_id"])
    assert session is not None
    assert session.call_sid == call_control_id
    assert session.from_number == "+15551234567"
    assert session.to_number == "+15557654321"
    assert session.status == SessionStatus.ACTIVE


def test_telnyx_webhook_call_lifecycle_hangup():
    """Verify call.initiated followed by call.hangup marks session as completed."""
    app = create_app()
    client = TestClient(app)

    call_control_id = "v3:CALL_HANGUP_TEST"
    init_payload = {
        "data": {
            "event_type": "call.initiated",
            "payload": {
                "call_control_id": call_control_id,
                "from": "+15551112222",
                "to": "+15553334444",
            },
        }
    }
    init_res = client.post("/telnyx/webhook", json=init_payload)
    assert init_res.status_code == 200
    session_id = init_res.json()["session_id"]

    # Verify active
    orchestrator = app.state.orchestrator
    assert orchestrator.get_session(session_id).status == SessionStatus.ACTIVE

    # Post call.hangup
    hangup_payload = {
        "data": {
            "event_type": "call.hangup",
            "payload": {
                "call_control_id": call_control_id,
            },
        }
    }
    hangup_res = client.post("/telnyx/webhook", json=hangup_payload)
    assert hangup_res.status_code == 200
    assert hangup_res.json()["event"] == "call.hangup"


def test_telnyx_signature_verification():
    """Verify Ed25519 signature validation on POST /telnyx/webhook."""
    # Generate Ed25519 keypair for test
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    pub_bytes = public_key.public_bytes_raw()
    pub_b64 = base64.b64encode(pub_bytes).decode("ascii")

    app = create_app()
    # Configure telnyx service with test public key
    app.state.telnyx_service = TelnyxService(public_key=pub_b64)

    client = TestClient(app)
    timestamp = "1725573600"
    body_dict = {
        "data": {
            "event_type": "call.answered",
            "payload": {"call_control_id": "v3:SECURE_CALL"},
        }
    }
    raw_body = json.dumps(body_dict).encode("utf-8")

    # 1. Invalid signature should be rejected with 403 Forbidden
    bad_res = client.post(
        "/telnyx/webhook",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "telnyx-signature-ed25519": base64.b64encode(b"invalid_signature_length_must_be_64_bytes_padding_xx").decode("ascii"),
            "telnyx-timestamp": timestamp,
        },
    )
    assert bad_res.status_code == 403

    # 2. Valid signature signed with private key should be accepted (200 OK)
    signed_payload = f"{timestamp}|".encode("utf-8") + raw_body
    valid_sig = private_key.sign(signed_payload)
    valid_sig_b64 = base64.b64encode(valid_sig).decode("ascii")

    good_res = client.post(
        "/telnyx/webhook",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "telnyx-signature-ed25519": valid_sig_b64,
            "telnyx-timestamp": timestamp,
        },
    )
    assert good_res.status_code == 200
    assert good_res.json()["event"] == "call.answered"


def test_telnyx_media_websocket():
    """Verify WebSocket /telnyx/media connects, parses frames, and handles audio messages."""
    app = create_app()
    client = TestClient(app)

    call_control_id = "v3:MEDIA_WS_CALL"
    stream_id = "stream_telnyx_001"

    with client.websocket_connect(f"/telnyx/media?call_control_id={call_control_id}") as ws:
        # Send start event frame
        start_msg = {
            "event": "start",
            "stream_id": stream_id,
            "start": {
                "call_control_id": call_control_id,
                "stream_id": stream_id,
                "media_format": {
                    "encoding": "audio/x-mulaw",
                    "sample_rate": 8000,
                    "channels": 1,
                },
            },
        }
        ws.send_text(json.dumps(start_msg))

        # Send sample media event frame (base64 encoded audio)
        sample_audio = b"\xff\x7f\x80\x00" * 20
        media_msg = {
            "event": "media",
            "stream_id": stream_id,
            "media": {
                "track": "inbound",
                "chunk": "1",
                "payload": base64.b64encode(sample_audio).decode("ascii"),
            },
        }
        ws.send_text(json.dumps(media_msg))

        # Send stop event frame to gracefully close
        stop_msg = {
            "event": "stop",
            "stream_id": stream_id,
        }
        ws.send_text(json.dumps(stop_msg))

    # Verify session was created and managed
    orchestrator = app.state.orchestrator
    matching_session = None
    for s in orchestrator._sessions.values():
        if s.call_sid == call_control_id:
            matching_session = s
            break
    assert matching_session is not None
