"""FastAPI Application entry point for Battle Buddy."""

from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api import supervisor_router, voice_router
from app.models.events import BattleBuddyEvent
from app.orchestrator import BattleBuddyOrchestrator
from app.services.openai_service import OpenAIService
from app.services.supabase_service import SupabaseService
from app.services.tts_service import TTSService
from app.services.twilio_service import TwilioService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("battle-buddy")


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

    # Attach to app state
    app.state.openai_service = openai_service
    app.state.supabase_service = supabase_service
    app.state.tts_service = tts_service
    app.state.twilio_service = twilio_service
    app.state.orchestrator = orchestrator

    # Active WebSocket clients for dashboard
    app.state.dashboard_websockets = set()

    async def broadcast_to_dashboards(event: BattleBuddyEvent):
        stale = []
        for ws in list(app.state.dashboard_websockets):
            try:
                await ws.send_json(event.model_dump())
            except Exception:
                stale.append(ws)
        for dead_ws in stale:
            app.state.dashboard_websockets.discard(dead_ws)

    orchestrator.subscribe(broadcast_to_dashboards)

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

    @app.websocket("/ws/events")
    async def websocket_event_stream(websocket: WebSocket):
        """Live WebSocket event feed for dashboards."""
        await websocket.accept()
        app.state.dashboard_websockets.add(websocket)
        try:
            while True:
                # Keep socket alive
                await websocket.receive_text()
        except WebSocketDisconnect:
            app.state.dashboard_websockets.discard(websocket)

    return app


app = create_app()
