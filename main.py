"""Root entrypoint for EchoSphere backend.
Re-exports the consolidated FastAPI application from app.main.
Allows running via `uvicorn main:app --reload` or `uvicorn app.main:app --reload`.
"""

import os
import sys

# Ensure workspace root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app, create_app
from app.config import settings
from app.models.events import EchoSphereEvent, BattleBuddyEvent, EventType, EVENT_ALIAS_MAP

def format_dashboard_payload(session_id: str, event_type: str, data: dict, channel_name: str = None) -> dict:
    """Helper for formatting real-time dashboard events."""
    return {
        "eventType": event_type,
        "sessionId": session_id,
        "channelName": channel_name or f"echosphere_{session_id[:8]}",
        "payload": data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
