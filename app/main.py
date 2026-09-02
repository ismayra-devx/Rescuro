"""FastAPI Application entry point for Battle Buddy."""

from contextlib import asynccontextmanager
import logging
import os
from typing import AsyncGenerator
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.api import supervisor_router, voice_router
from app.models.events import BattleBuddyEvent, EVENT_ALIAS_MAP
from app.orchestrator import BattleBuddyOrchestrator
from app.services.openai_service import OpenAIService
from app.services.supabase_service import SupabaseService
from app.services.tts_service import TTSService
from app.services.twilio_service import TwilioService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("battle-buddy")


def _make_broadcast_handler(app: FastAPI):
    """Factory creating broadcast handler for connected dashboard WebSocket clients."""
    async def broadcast_to_dashboards(event: BattleBuddyEvent):
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
    logger.info("Initializing Battle Buddy backend services...")

    openai_service = OpenAIService()
    supabase_service = SupabaseService()
    tts_service = TTSService()
    twilio_service = TwilioService()

    orchestrator = BattleBuddyOrchestrator(
        openai_service=openai_service,
        supabase_service=supabase_service,
        tts_service=tts_service,
    )

    app.state.openai_service = openai_service
    app.state.supabase_service = supabase_service
    app.state.tts_service = tts_service
    app.state.twilio_service = twilio_service
    app.state.orchestrator = orchestrator
    app.state.dashboard_websockets = set()

    orchestrator.subscribe(_make_broadcast_handler(app))

    yield

    logger.info("Shutting down Battle Buddy services...")


def create_app() -> FastAPI:
    """Factory creating configured FastAPI app."""
    app = FastAPI(
        title="Battle Buddy API",
        description="FastAPI Orchestration backend for emergency triage, voice streaming, and human handoff.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Initialize state attributes immediately for test clients and ASGI transports
    openai_service = OpenAIService()
    supabase_service = SupabaseService()
    tts_service = TTSService()
    twilio_service = TwilioService()
    orchestrator = BattleBuddyOrchestrator(
        openai_service=openai_service,
        supabase_service=supabase_service,
        tts_service=tts_service,
    )

    app.state.openai_service = openai_service
    app.state.supabase_service = supabase_service
    app.state.tts_service = tts_service
    app.state.twilio_service = twilio_service
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

    @app.get("/health", tags=["Health"])
    async def health_check():
        """Health check endpoint."""
        return {"status": "ok", "service": "battle-buddy-backend"}

    @app.get("/", response_class=HTMLResponse, tags=["Dashboard"])
    @app.get("/dashboard", response_class=HTMLResponse, tags=["Dashboard"])
    async def serve_dashboard():
        """Serve minimal React WebSocket dashboard."""
        html_path = os.path.join(os.path.dirname(__file__), "static", "dashboard.html")
        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        return HTMLResponse(content="<h1>Battle Buddy Dashboard</h1><p>dashboard.html not found</p>")

    @app.websocket("/ws/events")
    async def websocket_event_stream(websocket: WebSocket):
        """Live WebSocket event feed for dashboards."""
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
                # Keep socket alive
                await websocket.receive_text()
        except WebSocketDisconnect:
            app.state.dashboard_websockets.discard(websocket)

    return app


app = create_app()
