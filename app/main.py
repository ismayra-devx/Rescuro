"""RESCURO FastAPI Backend Application.
AI Voice Response & Dispatch System powered exclusively by Vobiz Telephony.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.api import auth, vobiz, dashboard_ws, calls, exotel

# Setup logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("rescuro.main")


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
                "base_ws_url": settings.BASE_WS_URL
            }
        )

    # Include feature routers
    application.include_router(auth.router)
    application.include_router(vobiz.router)
    application.include_router(dashboard_ws.router)
    application.include_router(calls.router)
    application.include_router(exotel.router)

    return application


app = create_app()
