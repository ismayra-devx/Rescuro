"""Twilio Voice Webhook endpoints."""

import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Form, Header, HTTPException, Request, Response
from app.services.twilio_service import TwilioService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Twilio Voice"])


@router.post("/incoming")
async def voice_incoming(
    request: Request,
    CallSid: Optional[str] = Form(None),
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    x_twilio_signature: Optional[str] = Header(None, alias="X-Twilio-Signature"),
) -> Response:
    """Twilio incoming call webhook.
    
    Thin webhook handler: validates signature, dispatches session initialization,
    and returns valid TwiML connecting the call to the media stream.
    """
    orchestrator = request.app.state.orchestrator
    twilio_service: TwilioService = request.app.state.twilio_service

    # Optional signature verification
    url = str(request.url)
    form_data = await request.form()
    params = dict(form_data)
    if not twilio_service.validate_signature(url, params, x_twilio_signature):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature.")

    # Create session
    session = await orchestrator.create_session(
        call_sid=CallSid,
        from_number=From,
        to_number=To,
    )

    # Generate media stream TwiML
    twiml_xml = twilio_service.generate_stream_twiml(session.session_id)
    return Response(content=twiml_xml, media_type="application/xml")


@router.post("/status")
async def voice_status(
    request: Request,
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
            # Asynchronously dispatch end call
            asyncio.create_task(orchestrator.end_call(target_sid))

    return {"status": "received", "call_status": CallStatus}
