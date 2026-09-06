"""Tests for RESCURO Supervisor Audio Bridge:
- AudioBridgeManager singleton lifecycle
- Exotel stream registration and unregistration
- Supervisor websocket connection registration and unregistration
- Bidirectional audio packet delivery:
    * Caller PCM16 -> Exotel -> AudioBridgeManager -> Supervisor WebSocket (CALLER_AUDIO_CHUNK)
    * Supervisor PCM16 -> AudioBridgeManager -> Exotel WebSocket (media event)
- Verbal supervisor intent detection (English, Hindi, Hinglish)
"""

import pytest
import json
import base64
from unittest.mock import AsyncMock
from app.services.audio_bridge import AudioBridgeManager
from app.services.openai_service import OpenAIService, SUPERVISOR_KEYWORDS
from app.services.pipeline import run_orchestrator


@pytest.mark.asyncio
async def test_audio_bridge_caller_to_supervisor_routing():
    """Verify caller PCM16 audio packet is routed to connected supervisor consoles."""
    bridge = AudioBridgeManager()
    session_id = "test_bridge_sess_001"
    
    # Mock Exotel websocket
    mock_exotel_ws = AsyncMock()
    bridge.register_exotel_stream(session_id, mock_exotel_ws, "STREAM_EXOTEL_123")
    assert bridge.is_exotel_connected(session_id) is True

    # Mock Supervisor websocket
    mock_supervisor_ws = AsyncMock()
    bridge.register_supervisor(session_id, mock_supervisor_ws)

    # Route caller audio
    raw_caller_pcm = b"\x00\x01\x02\x03" * 160  # 640 bytes (320 samples at 8kHz = 40ms)
    await bridge.route_caller_audio(session_id, raw_caller_pcm)

    # Verify supervisor received CALLER_AUDIO_CHUNK
    assert mock_supervisor_ws.send_text.called
    sent_text = mock_supervisor_ws.send_text.call_args[0][0]
    payload = json.loads(sent_text)
    assert payload["event"] == "CALLER_AUDIO_CHUNK"
    assert payload["session_id"] == session_id
    assert payload["payload"]["format"] == "linear16_8khz_mono"
    assert payload["payload"]["sample_rate"] == 8000
    assert payload["payload"]["audio"] == base64.b64encode(raw_caller_pcm).decode("utf-8")

    # Clean up
    bridge.unregister_supervisor(session_id, mock_supervisor_ws)
    bridge.unregister_exotel_stream(session_id)
    assert bridge.is_exotel_connected(session_id) is False


@pytest.mark.asyncio
async def test_audio_bridge_supervisor_to_exotel_routing():
    """Verify supervisor microphone PCM16 audio is formatted as Exotel media frame and sent to Exotel."""
    bridge = AudioBridgeManager()
    session_id = "test_bridge_sess_002"
    stream_sid = "STREAM_SID_999"

    mock_exotel_ws = AsyncMock()
    bridge.register_exotel_stream(session_id, mock_exotel_ws, stream_sid)

    raw_supervisor_pcm = b"\x10\x20\x30\x40" * 160
    await bridge.route_supervisor_audio(session_id, raw_supervisor_pcm)

    assert mock_exotel_ws.send_text.called
    sent_text = mock_exotel_ws.send_text.call_args[0][0]
    exotel_frame = json.loads(sent_text)
    assert exotel_frame["event"] == "media"
    assert exotel_frame["stream_sid"] == stream_sid
    assert "media" in exotel_frame
    assert exotel_frame["media"]["payload"] == base64.b64encode(raw_supervisor_pcm).decode("utf-8")

    bridge.unregister_exotel_stream(session_id)


@pytest.mark.asyncio
async def test_audio_bridge_multiple_supervisors_broadcast():
    """Verify caller audio broadcasts to all connected supervisors and gracefully handles dead sockets."""
    bridge = AudioBridgeManager()
    session_id = "test_bridge_sess_003"

    mock_sup_1 = AsyncMock()
    mock_sup_2 = AsyncMock()
    mock_sup_dead = AsyncMock()
    mock_sup_dead.send_text.side_effect = Exception("Connection closed")

    bridge.register_supervisor(session_id, mock_sup_1)
    bridge.register_supervisor(session_id, mock_sup_2)
    bridge.register_supervisor(session_id, mock_sup_dead)

    raw_pcm = b"\x01\x02" * 80
    await bridge.route_caller_audio(session_id, raw_pcm)

    assert mock_sup_1.send_text.called
    assert mock_sup_2.send_text.called
    # Dead supervisor should have been cleaned up automatically
    assert mock_sup_dead not in bridge.get_supervisors(session_id)

    bridge.unregister_supervisor(session_id, mock_sup_1)
    bridge.unregister_supervisor(session_id, mock_sup_2)


@pytest.mark.asyncio
async def test_supervisor_verbal_intent_detection():
    """Verify English, Hindi, and Hinglish supervisor requests trigger supervisor_escalation and supervisor_requested."""
    service = OpenAIService()
    supervisor_phrases = [
        "I want to speak to a supervisor",
        "Can I speak with a human agent?",
        "Transfer me to supervisor right now",
        "Mujhe supervisor se baat karni hai",
        "Supervisor ko bulao",
        "Kisi human se baat karwao",
        "Manager se baat karao",
        "Connect me to an operator"
    ]
    for phrase in supervisor_phrases:
        result = await service.extract_intent(phrase)
        assert result.incident_type == "supervisor_escalation", f"Failed for phrase: '{phrase}', got {result}"
        assert result.route == "human_supervisor"
        
        orch_res = await run_orchestrator(phrase)
        assert orch_res.get("supervisor_requested") is True, f"Failed orchestrator for phrase: '{phrase}', got {orch_res}"
