"""Root entrypoint for RESCURO backend.
Re-exports the FastAPI application from app.main.
Run locally via:
    uvicorn main:app --reload
"""

import os
from app.main import app, create_app, format_dashboard_payload
from app.config import settings

__all__ = ["app", "create_app", "format_dashboard_payload", "settings"]



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )

