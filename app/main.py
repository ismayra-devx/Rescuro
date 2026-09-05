"""FastAPI Application entry point for EchoSphere Backend."""

from contextlib import asynccontextmanager
import json
import logging
import os
from typing import AsyncGenerator, Dict, Any, Optional
import uuid

from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse

from app.api import supervisor_router, voice_router, telnyx_router
from app.config import settings, verify_required_keys
from app.models.events import EchoSphereEvent, EVENT_ALIAS_MAP
from app.orchestrator import EchoSphereOrchestrator
from app.services.openai_service import OpenAIService
from app.services.supabase_service import SupabaseService
from app.services.tts_service import TTSService
from app.services.twilio_service import TwilioService
from app.services.telnyx_service import telnyx_service, TelnyxService
from app.services.deepgram_service import deepgram_service, DeepgramService
from app.services.slack_service import slack_service, SlackService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("echosphere")


def _make_broadcast_handler(app: FastAPI):
    """Factory creating broadcast handler for connected dashboard WebSocket clients."""
    async def broadcast_to_dashboards(event: EchoSphereEvent):
        stale = []
        data = event.model_dump()
        if event.event_type in EVENT_ALIAS_MAP:
            alias = EVENT_ALIAS_MAP[event.event_type]
            data["event_alias"] = alias
            data["event"] = alias
            data["type"] = alias

        for ws in list(app.state.dashboard_websockets):
            try:
                await ws.send_json(data)
            except Exception:
                stale.append(ws)
        for dead_ws in stale:
            app.state.dashboard_websockets.discard(dead_ws)

    return broadcast_to_dashboards


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize vendor services and orchestration engine."""
    logger.info("Initializing EchoSphere backend services...")

    openai_service = OpenAIService()
    supabase_service = SupabaseService()
    tts_service = TTSService()
    twilio_service = TwilioService()

    orchestrator = EchoSphereOrchestrator(
        openai_service=openai_service,
        supabase_service=supabase_service,
        tts_service=tts_service,
    )

    app.state.openai_service = openai_service
    app.state.supabase_service = supabase_service
    app.state.tts_service = tts_service
    app.state.twilio_service = twilio_service
    app.state.telnyx_service = telnyx_service
    app.state.deepgram_service = deepgram_service
    app.state.slack_service = slack_service
    app.state.orchestrator = orchestrator
    app.state.dashboard_websockets = set()

    orchestrator.subscribe(_make_broadcast_handler(app))

    yield

    logger.info("Shutting down EchoSphere services...")


def create_app() -> FastAPI:
    """Factory creating configured FastAPI app."""
    app = FastAPI(
        title="EchoSphere API",
        description="FastAPI Orchestration backend for emergency triage, voice streaming, and human handoff.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Initialize state attributes immediately for test clients and ASGI transports
    openai_service = OpenAIService()
    supabase_service = SupabaseService()
    tts_service = TTSService()
    twilio_service = TwilioService()
    orchestrator = EchoSphereOrchestrator(
        openai_service=openai_service,
        supabase_service=supabase_service,
        tts_service=tts_service,
    )

    app.state.openai_service = openai_service
    app.state.supabase_service = supabase_service
    app.state.tts_service = tts_service
    app.state.twilio_service = twilio_service
    app.state.telnyx_service = telnyx_service
    app.state.deepgram_service = deepgram_service
    app.state.slack_service = slack_service
    app.state.orchestrator = orchestrator
    app.state.dashboard_websockets = set()

    # Subscribe dashboard broadcaster for test & live transports
    orchestrator.subscribe(_make_broadcast_handler(app))

    # Allow CORS for dashboard access
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(voice_router)
    app.include_router(supervisor_router)
    app.include_router(telnyx_router)

    # Health Check Endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        """Health check endpoint confirming service status and configuration."""
        missing = verify_required_keys(exit_on_failure=False)
        return {
            "status": "ok",
            "service": "echosphere-backend",
            "environment": settings.ENVIRONMENT,
            "escalation_threshold": settings.CONFIDENCE_ESCALATION_THRESHOLD,
            "config_complete": len(missing) == 0,
        }

    # Dashboard HTML Serving
    @app.get("/", response_class=HTMLResponse, tags=["Dashboard"])
    @app.get("/dashboard", response_class=HTMLResponse, tags=["Dashboard"])
    async def serve_dashboard():
        """Serve minimal React WebSocket dashboard."""
        html_path = os.path.join(os.path.dirname(__file__), "static", "dashboard.html")
        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        return HTMLResponse(content="<h1>EchoSphere Dashboard</h1><p>dashboard.html not found</p>")

    # Live WebSocket Feeds for Dashboards
    async def _handle_dashboard_ws(websocket: WebSocket):
        await websocket.accept()
        app.state.dashboard_websockets.add(websocket)
        try:
            # Zero-polling initial snapshot handshake: send active sessions state immediately
            orchestrator = app.state.orchestrator
            for session_id, session in orchestrator._sessions.items():
                if session.status.value in ["ACTIVE", "SUPERVISOR_CONNECTED"]:
                    await websocket.send_json({
                        "event_type": "NEW_CALL",
                        "event": "NEW_CALL",
                        "type": "NEW_CALL",
                        "session_id": session_id,
                        "payload": {
                            "session_id": session_id,
                            "call_sid": session.call_sid,
                            "status": session.status.value,
                            "tts_halted": session.tts_halted,
                        },
                    })
                    if session.latest_transcript:
                        await websocket.send_json({
                            "event_type": "TRANSCRIPT_UPDATE",
                            "event": "TRANSCRIPT_UPDATE",
                            "type": "TRANSCRIPT_UPDATE",
                            "session_id": session_id,
                            "payload": {
                                "transcript": session.latest_transcript,
                                "stt_confidence": 0.95,
                            },
                        })
                    if session.latest_triage:
                        await websocket.send_json({
                            "event_type": "TRIAGE_UPDATE",
                            "event": "TRIAGE_UPDATE",
                            "type": "TRIAGE_UPDATE",
                            "session_id": session_id,
                            "payload": session.latest_triage,
                        })

            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            app.state.dashboard_websockets.discard(websocket)
        except Exception:
            app.state.dashboard_websockets.discard(websocket)


    @app.websocket("/ws/events")
    async def websocket_event_stream(websocket: WebSocket):
        """Live WebSocket event feed for React dashboard."""
        await _handle_dashboard_ws(websocket)

    @app.websocket("/ws/dashboard")
    async def websocket_dashboard_stream(websocket: WebSocket):
        """EchoSphere compatible live WebSocket feed."""
        await _handle_dashboard_ws(websocket)

    @app.websocket("/api/v1/stream/calls")
    async def websocket_rescuro_stream(websocket: WebSocket):
        """Rescuro compatible live WebSocket stream alias."""
        await _handle_dashboard_ws(websocket)

    @app.get("/dashboard/stream", tags=["Dashboard"])
    async def sse_dashboard_stream():
        """Server-Sent Events (SSE) stream for dashboards."""
        import asyncio

        async def event_generator():
            yield f"data: {json.dumps({'event': 'connected', 'status': 'listening'})}\n\n"
            while True:
                await asyncio.sleep(15)
                yield f"data: {json.dumps({'event': 'heartbeat', 'timestamp': uuid.uuid1().time})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    # Compatibility Aliases for EchoSphere Frontend & Routes
    @app.post("/call/transcript", tags=["EchoSphere"])
    async def call_transcript_alias(request: Request):
        """EchoSphere compatibility endpoint for streaming transcripts into triage pipeline."""
        body = await request.json()
        session_id = body.get("session_id", "default_session")
        transcript = body.get("text") or body.get("transcript", "")
        stt_conf = float(body.get("deepgram_confidence") or body.get("stt_confidence", 0.9))
        orchestrator = request.app.state.orchestrator

        result = await orchestrator.process_transcript(
            session_id=session_id,
            transcript=transcript,
            stt_confidence=stt_conf,
        )
        return {
            "status": "success",
            "ticket_id": result.get("ticket_id"),
            "conversational_reply": result.get("conversational_reply", ""),
            "confidence": result.get("triage_result", {}).get("combined_confidence", 0.8),
            "should_escalate": result.get("triage_result", {}).get("route") != "automated",
            "escalation_reason": result.get("triage_result", {}).get("reason"),
            "safety_flag": result.get("triage_result", {}).get("priority") in ["HIGH", "CRITICAL"],
            "triage_result": result.get("triage_result"),
            "llm_result": result.get("llm_result"),
        }

    @app.post("/call/escalate", tags=["EchoSphere"])
    async def call_escalate_alias(request: Request):
        """EchoSphere compatibility endpoint for supervisor escalation."""
        body = await request.json()
        session_id = (body.get("session_id") or "").strip()
        reason = body.get("reason", "Manual operator escalation")
        if not session_id:
            raise HTTPException(status_code=422, detail="Valid session_id is required.")

        orchestrator = request.app.state.orchestrator
        session = orchestrator.get_session(session_id)
        if not session:
            session = orchestrator.create_session_instant(call_sid=f"ESC_{session_id[:8]}")
            session_id = session.session_id

        updated = await orchestrator.supervisor_override(session_id, reason=reason)
        return {
            "status": "escalated",
            "session_id": updated.session_id,
            "channel_name": f"echosphere_{updated.session_id[:8]}",
            "supervisor_rtc_token": f"token_{updated.session_id[:8]}",
            "reason": reason,
            "tts_halted": updated.tts_halted,
        }

    @app.websocket("/voice/stream")
    async def voice_media_stream(websocket: WebSocket):
        """Twilio Media Stream raw mulaw audio WebSocket handler."""
        await websocket.accept()
        try:
            while True:
                message = await websocket.receive_text()
                data = json.loads(message)
                if data.get("event") == "stop":
                    break
        except WebSocketDisconnect:
            pass

    return app


# Shared singleton application
app = create_app()
