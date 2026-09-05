from fastapi import APIRouter, Request, WebSocket

router = APIRouter(prefix="/telnyx", tags=["telnyx"])


@router.get("/health")
async def telnyx_health():
    return {"status": "ok", "service": "rescuro-telnyx"}


@router.post("/webhook")
async def telnyx_webhook(request: Request):
    payload = await request.json()
    print("Telnyx event received:", payload)
    return {"received": True}


@router.websocket("/media")
async def telnyx_media(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # TODO: forward audio frames to Deepgram STT -> orchestrator.py -> TTS -> back to Telnyx
            print("Media frame received:", len(data))
    except Exception as e:
        print("Media socket closed:", e)
