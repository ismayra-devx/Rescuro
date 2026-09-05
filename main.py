"""Root entrypoint for RESCURO backend.
Re-exports the FastAPI application from app.main.
Run locally via:
    uvicorn main:app --reload
"""

import os
import sys

# Ensure workspace root is in Python module search path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app, create_app
from app.config import settings

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
