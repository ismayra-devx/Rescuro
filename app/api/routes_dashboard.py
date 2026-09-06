"""Unified Dashboard API routes for configuration, simulation, Agora RTC tokens, and Slack alerts."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings

router = APIRouter(prefix="/api", tags=["Unified Dashboard"])


class AgoraTokenRequest(BaseModel):
    channel_name: str = Field(default="rescuro-emergency-channel")
    uid: int = Field(default=0)
    role: str = Field(default="publisher")


class SlackTestRequest(BaseModel):
    message: Optional[str] = "🔔 Rescuro Test Alert: Emergency Dispatch System is operational."
    session_id: Optional[str] = "test-session"


class SimulateCallRequest(BaseModel):
    caller_name: Optional[str] = "Simulated Caller"
    from_number: Optional[str] = "+19876543210"
    transcript: str = Field(..., description="Transcript text to simulate")
    stt_confidence: float = Field(default=0.92, ge=0.0, le=1.0)


@router.get("/config/status")
async def get_services_status(request: Request) -> Dict[str, Any]:
    """Returns the integration status of all configured vendor APIs."""
    return {
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "services": {
            "openai": {
                "configured": bool(settings.OPENAI_API_KEY),
                "model": settings.OPENAI_MODEL,
                "key_preview": f"sk-...{settings.OPENAI_API_KEY[-4:]}" if settings.OPENAI_API_KEY else None,
            },
            "deepgram": {
                "configured": bool(settings.DEEPGRAM_API_KEY),
                "key_preview": f"...{settings.DEEPGRAM_API_KEY[-4:]}" if settings.DEEPGRAM_API_KEY else None,
            },
            "twilio": {
                "configured": bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN),
                "account_sid_preview": f"{settings.TWILIO_ACCOUNT_SID[:6]}..." if settings.TWILIO_ACCOUNT_SID else None,
                "phone_number": settings.TWILIO_PHONE_NUMBER,
            },
            "supabase": {
                "configured": bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY),
                "url": settings.SUPABASE_URL,
            },
            "agora": {
                "configured": bool(settings.AGORA_APP_ID),
                "app_id": settings.AGORA_APP_ID,
                "has_certificate": bool(settings.AGORA_APP_CERTIFICATE),
                "has_customer_key": bool(settings.AGORA_CUSTOMER_KEY),
            },
            "slack": {
                "configured": bool(settings.SLACK_WEBHOOK_URL and "http" in settings.SLACK_WEBHOOK_URL),
                "webhook_configured": bool(settings.SLACK_WEBHOOK_URL),
            },
        },
        "thresholds": {
            "confidence_escalation_threshold": settings.CONFIDENCE_ESCALATION_THRESHOLD,
            "host": settings.HOST,
            "port": settings.PORT,
        },
    }


@router.get("/agora/token")
async def get_agora_token(
    request: Request,
    channel: str = "rescuro-emergency-channel",
    uid: int = 0,
) -> Dict[str, Any]:
    """Generate or retrieve an Agora RTC token for the given channel."""
    agora_service = request.app.state.agora_service
    token_data = agora_service.generate_rtc_token(channel_name=channel, uid=uid)
    return token_data


@router.post("/slack/test")
async def send_slack_test(request: Request, body: SlackTestRequest) -> Dict[str, Any]:
    """Manually dispatch a test or incident alert to Slack."""
    slack_service = request.app.state.slack_service
    success = await slack_service.send_emergency_alert(
        session_id=body.session_id or "manual-test",
        incident_type="Test Broadcast",
        urgency="HIGH",
        priority="HIGH",
        reason=body.message or "Manual alert initiated from Unified Dashboard",
        transcript=body.message or "Test message",
    )
    return {"dispatched": success, "message": body.message}


@router.get("/sessions")
async def get_all_sessions(request: Request) -> Dict[str, Any]:
    """Retrieve all current sessions."""
    orchestrator = request.app.state.orchestrator
    sessions = orchestrator.get_all_sessions()
    return {"count": len(sessions), "sessions": sessions}


@router.post("/simulate/call")
async def simulate_call(request: Request, body: SimulateCallRequest) -> Dict[str, Any]:
    """Simulate a complete call cycle: Session Creation -> STT -> LLM Triage -> TTS / Supervisor Handshake."""
    orchestrator = request.app.state.orchestrator
    session = await orchestrator.create_session(
        from_number=body.from_number,
        to_number="+1800RESCURO",
    )
    result = await orchestrator.process_transcript(
        session_id=session.session_id,
        transcript=body.transcript,
        stt_confidence=body.stt_confidence,
    )
    return result
