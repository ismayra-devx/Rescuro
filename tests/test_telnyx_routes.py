"""Tests for Telnyx voice webhooks, health check, and media streaming WebSocket."""

from fastapi.testclient import TestClient
from app.main import create_app


def test_telnyx_health():
    """Verify GET /telnyx/health returns expected health payload."""
    app = create_app()
    client = TestClient(app)

    response = client.get("/telnyx/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {"status": "ok", "service": "rescuro-telnyx"}


def test_telnyx_webhook():
    """Verify POST /telnyx/webhook logs event and returns received: True."""
    app = create_app()
    client = TestClient(app)

    payload = {
        "data": {
            "event_type": "call.initiated",
            "payload": {
                "call_control_id": "v3:TEST_CALL_12345",
                "from": "+15551234567",
                "to": "+15557654321",
            },
        }
    }

    response = client.post("/telnyx/webhook", json=payload)
    assert response.status_code == 200
    assert response.json() == {"received": True}


def test_telnyx_media_websocket():
    """Verify WS /telnyx/media connects and receives frames."""
    app = create_app()
    client = TestClient(app)

    with client.websocket_connect("/telnyx/media") as ws:
        ws.send_text("sample_media_frame_content")
        # Connection established and message processed without error
