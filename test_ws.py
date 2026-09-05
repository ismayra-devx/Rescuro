import websocket
ws = websocket.create_connection('wss://rescuro-1.onrender.com/telnyx/media')
print('Connected!')
ws.close()