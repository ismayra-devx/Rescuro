"""Twilio Voice Webhook endpoints."""

import logging
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Form, Header, HTTPException, Request, Response
from app.services.twilio_service import TwilioService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Twilio Voice"])


@router.post("/incoming")
async def voice_incoming(
    request: Request,
    background_tasks: BackgroundTasks,
    CallSid: Optional[str] = Form(None),
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    x_twilio_signature: Optional[str] = Header(None, alias="X-Twilio-Signature"),
) -> Response:
    """Twilio incoming call webhook.
    
    Thin webhook handler: validates signature, dispatches session initialization,
    and returns valid TwiML connecting the call to the media stream immediately.
    No LLM, database, or audio processing is executed directly inside this handler.
    """
    orchestrator = request.app.state.orchestrator
    twilio_service: TwilioService = request.app.state.twilio_service

    # 1. Signature validation using Twilio SDK
    url = str(request.url)
    form_data = await request.form()
    params = dict(form_data)
    if not twilio_service.validate_signature(url, params, x_twilio_signature):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature.")

    # 2. Instant thin registration in memory
    session = orchestrator.create_session_instant(
        call_sid=CallSid,
        from_number=From,
        to_number=To,
    )

    # 3. Offload session event persistence to background task
    background_tasks.add_task(orchestrator.persist_session_start, session)

    # 4. Generate media stream TwiML and return quickly
    twiml_xml = twilio_service.generate_stream_twiml(session.session_id)
    return Response(content=twiml_xml, media_type="application/xml")


@router.post("/status")
async def voice_status(
    request: Request,
    background_tasks: BackgroundTasks,
    CallSid: Optional[str] = Form(None),
    CallStatus: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
) -> dict:
    """Twilio call status callback webhook.
    
    Dispatches session termination asynchronously and returns quickly.
    """
    orchestrator = request.app.state.orchestrator

    if CallStatus in ["completed", "failed", "busy", "no-answer"]:
        target_sid = session_id
        if not target_sid and CallSid:
            # Match session by CallSid
            for sid, s in orchestrator._sessions.items():
                if s.call_sid == CallSid:
                    target_sid = sid
                    break

        if target_sid:
            # Asynchronously dispatch end call in background task
            background_tasks.add_task(orchestrator.end_call, target_sid)

    return {"status": "received", "call_status": CallStatus}
