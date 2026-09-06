import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse

from app.config import settings
from app.database import init_db
from app.api import auth, vobiz, dashboard_ws, calls, exotel, routes_voice, routes_supervisor
from app.api.dashboard_ws import dashboard_manager
from app.orchestrator import EchoSphereOrchestrator
from app.models.events import EchoSphereEvent, EVENT_ALIAS_MAP
from app.services.openai_service import OpenAIService
from app.services.supabase_service import SupabaseService
from app.services.tts_service import TTSService
from app.services.twilio_service import TwilioService

# Setup logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("rescuro.main")


def _make_broadcast_handler(app_inst: FastAPI):
    """Factory creating broadcast handler for connected dashboard WebSocket clients."""
    async def broadcast_to_dashboards(event: EchoSphereEvent):
        # 1. Broadcast to raw WebSocket subscribers (e.g. tests /ws/events)
        stale = []
        data = event.model_dump()
        if event.event_type in EVENT_ALIAS_MAP:
            alias = EVENT_ALIAS_MAP[event.event_type]
            data["event_alias"] = alias
            data["event"] = alias
            data["type"] = alias

        for ws in list(app_inst.state.dashboard_websockets):
            try:
                await ws.send_json(data)
            except Exception:
                stale.append(ws)
        for dead_ws in stale:
            app_inst.state.dashboard_websockets.discard(dead_ws)

        # 2. Broadcast to authenticated dashboard manager clients (/ws/dashboard)
        try:
            await dashboard_manager.broadcast(event.event_type.value, event.payload or {})
        except Exception:
            pass

    return broadcast_to_dashboards


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown hooks."""
    logger.info("Starting %s (%s)...", settings.APP_NAME, settings.ENVIRONMENT)
    # Initialize SQLite database schema
    await init_db()
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)


def create_app() -> FastAPI:
    """FastAPI application factory."""
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="RESCURO AI Voice Response and Emergency Dispatch Backend with Vobiz Telephony",
        lifespan=lifespan
    )

    # Cross-Origin Resource Sharing (CORS)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # State & Orchestrator wiring
    openai_service_inst = OpenAIService()
    supabase_service_inst = SupabaseService()
    tts_service_inst = TTSService()
    twilio_service_inst = TwilioService()

    orchestrator = EchoSphereOrchestrator(
        openai_service=openai_service_inst,
        supabase_service=supabase_service_inst,
        tts_service=tts_service_inst,
    )
    application.state.orchestrator = orchestrator
    application.state.twilio_service = twilio_service_inst
    application.state.supabase_service = supabase_service_inst
    application.state.openai_service = openai_service_inst
    application.state.tts_service = tts_service_inst
    application.state.dashboard_websockets = set()

    # Subscribe dashboard broadcaster for test & live transports
    orchestrator.subscribe(_make_broadcast_handler(application))

    # Health Check Route (GET /health)
    @application.get("/health", tags=["System"])
    async def health_check():
        """Health check endpoint for container health probes and uptime monitoring."""
        return JSONResponse(
            status_code=200,
            content={
                "status": "healthy",
                "service": "RESCURO",
                "version": settings.APP_VERSION,
                "environment": settings.ENVIRONMENT,
                "telephony": "vobiz",
                "stt_provider": settings.STT_PROVIDER,
                "tts_provider": settings.TTS_PROVIDER,
                "deepgram_configured": bool(settings.DEEPGRAM_API_KEY and not settings.DEEPGRAM_API_KEY.startswith("your_")),
                "deepgram_model": settings.DEEPGRAM_MODEL,
                "deepgram_language": settings.DEEPGRAM_LANGUAGE,
                "supabase_configured": settings.is_supabase_auth_configured,
                "escalation_threshold": settings.CONFIDENCE_ESCALATION_THRESHOLD,
                "base_ws_url": settings.BASE_WS_URL
            }
        )

    # Mount frontend static assets if built
    dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist")
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        from fastapi.staticfiles import StaticFiles
        application.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Dashboard HTML Serving
    @application.get("/", response_class=HTMLResponse, tags=["Dashboard"])
    @application.get("/dashboard", response_class=HTMLResponse, tags=["Dashboard"])
    async def serve_dashboard():
        """Serve the unified frontend dashboard."""
        dist_html = os.path.join(dist_dir, "index.html")
        if os.path.exists(dist_html):
            with open(dist_html, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())

        html_path = os.path.join(os.path.dirname(__file__), "static", "dashboard.html")
        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        return HTMLResponse(content="<h1>RESCURO Emergency Command Center</h1><p>Frontend assets not found.</p>")

    # Dashboard WebSocket Feeds (raw / events)
    async def _handle_dashboard_ws(websocket: WebSocket):
        await websocket.accept()
        application.state.dashboard_websockets.add(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            application.state.dashboard_websockets.discard(websocket)
        except Exception:
            application.state.dashboard_websockets.discard(websocket)

    @application.websocket("/ws/events")
    async def websocket_event_stream(websocket: WebSocket):
        """Live WebSocket event feed for React dashboard."""
        await _handle_dashboard_ws(websocket)

    @application.websocket("/api/v1/stream/calls")
    async def websocket_calls_stream(websocket: WebSocket):
        """Live WebSocket stream alias for call events."""
        await _handle_dashboard_ws(websocket)

    # EchoSphere / Legacy Compatibility Endpoints
    @application.post("/call/transcript", tags=["EchoSphere"])
    async def call_transcript_alias(request: Request):
        """EchoSphere compatibility endpoint for streaming transcripts into triage pipeline."""
        body = await request.json()
        session_id = body.get("session_id", "default_session")
        transcript = body.get("text") or body.get("transcript", "")
        stt_conf = float(body.get("deepgram_confidence") or body.get("stt_confidence", 0.9))
        orch = request.app.state.orchestrator

        result = await orch.process_transcript(
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

    @application.post("/call/escalate", tags=["EchoSphere"])
    async def call_escalate_alias(request: Request):
        """EchoSphere compatibility endpoint for supervisor escalation."""
        body = await request.json()
        session_id = (body.get("session_id") or "").strip()
        reason = body.get("reason", "Manual operator escalation")
        if not session_id:
            raise HTTPException(status_code=422, detail="Valid session_id is required.")

        orch = request.app.state.orchestrator
        session = orch.get_session(session_id)
        if not session:
            session = orch.create_session_instant(call_sid=f"ESC_{session_id[:8]}")
            session_id = session.session_id

        updated = await orch.supervisor_override(session_id, reason=reason)
        return {
            "status": "escalated",
            "session_id": updated.session_id,
            "channel_name": f"echosphere_{updated.session_id[:8]}",
            "supervisor_rtc_token": f"token_{updated.session_id[:8]}",
            "reason": reason,
            "tts_halted": updated.tts_halted,
        }

    # Include feature routers
    application.include_router(auth.router)
    application.include_router(vobiz.router)
    application.include_router(dashboard_ws.router)
    application.include_router(calls.router)
    application.include_router(exotel.router)
    application.include_router(routes_voice.router)
    application.include_router(routes_supervisor.router)

    return application


app = create_app()


def format_dashboard_payload(
    session_id: str,
    event_type: str,
    data: dict,
    channel_name: str = ""
) -> dict:
    """Format an event dictionary for dashboard WebSocket broadcast and test contracts."""
    return {
        "eventType": event_type,
        "sessionId": session_id,
        "channelName": channel_name,
        "payload": data
    }
