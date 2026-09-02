"""API endpoints package."""

from app.api.routes_supervisor import router as supervisor_router
from app.api.routes_voice import router as voice_router

__all__ = ["voice_router", "supervisor_router"]
