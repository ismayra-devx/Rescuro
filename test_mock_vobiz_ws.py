"""RESCURO Vobiz WebSocket Test Script.

Tests the /vobiz/media WebSocket route locally with mock Vobiz JSON messages.
Usage:
    # 1. Start backend in terminal 1:
    uvicorn main:app --reload

    # 2. Run this test script in terminal 2:
    python test_mock_vobiz_ws.py
"""

import sys
import json
import base64
import asyncio

try:
    import websockets
except ImportError:
    print("Error: 'websockets' library is required. Install via: pip install websockets")
    sys.exit(1)


async def test_vobiz_media_stream(ws_url: str = "ws://127.0.0.1:8000/vobiz/media"):
    print(f"Connecting to Vobiz media WebSocket at: {ws_url} ...")
    try:
        async with websockets.connect(ws_url) as ws:
            print(" Connected successfully to /vobiz/media!")

            # 1. Send simulated 'start' event from Vobiz
            start_msg = {
                "event": "start",
                "stream_id": "test_vobiz_stream_001",
                "call_id": "call_mock_emergency_123",
                "media_format": {"encoding": "audio/x-mulaw", "sample_rate": 8000, "channels": 1}
            }
            print(f"\n[->] Sending Vobiz 'start' event:\n{json.dumps(start_msg, indent=2)}")
            await ws.send(json.dumps(start_msg))
            await asyncio.sleep(0.5)

            # 2. Send simulated 'media' audio chunk (160 bytes of μ-law silence base64 encoded)
            mock_audio_chunk = b"\xFF" * 160
            mock_b64 = base64.b64encode(mock_audio_chunk).decode("ascii")
            media_msg = {
                "event": "media",
                "stream_id": "test_vobiz_stream_001",
                "media": {
                    "payload": mock_b64,
                    "timestamp": 1000
                }
            }
            print(f"\n[->] Sending Vobiz 'media' audio chunk (160 bytes payload):")
            print(f"    Payload: {mock_b64[:20]}... [truncated]")
            await ws.send(json.dumps(media_msg))

            # 3. Await synthesized speech response from RESCURO backend
            print("\n[<-] Waiting for synthesized response audio from RESCURO...")
            try:
                response_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                response_data = json.loads(response_raw)
                print(f"[<-] Received response from backend:\n{json.dumps(response_data, indent=2)}")
                outbound_audio = response_data.get("media", {}).get("payload", "")
                print(f" Received {len(outbound_audio)} base64 characters of synthesized audio!")
            except asyncio.TimeoutError:
                print("⚠️ Timed out waiting for media response.")

            # 4. Send simulated 'stop' event
            stop_msg = {
                "event": "stop",
                "stream_id": "test_vobiz_stream_001"
            }
            print(f"\n[->] Sending Vobiz 'stop' event:\n{json.dumps(stop_msg, indent=2)}")
            await ws.send(json.dumps(stop_msg))
            await asyncio.sleep(0.5)

            print("\n Vobiz media WebSocket test passed successfully!")

    except ConnectionRefusedError:
        print(f"\n❌ Connection Refused: Could not connect to {ws_url}.")
        print("   Make sure the RESCURO backend is running: uvicorn main:app --reload")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")


if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else "ws://127.0.0.1:8000/vobiz/media"
    asyncio.run(test_vobiz_media_stream(target_url))
