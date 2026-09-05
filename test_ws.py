import os
import websocket

ws_url = os.getenv("TEST_WS_URL", "ws://127.0.0.1:8000/ws/events")
ws = websocket.create_connection(ws_url)
print('Connected!')
ws.close()