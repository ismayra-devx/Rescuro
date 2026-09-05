"""Root entrypoint for RESCURO backend.
Re-exports the FastAPI application from app.main.
Run locally via:
    uvicorn main:app --reload
"""

import os
import sys
from fastapi.middleware.cors import CORSMiddleware

# Ensure workspace root is in Python module search path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app, create_app
from app.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rescuro-2.onrender.com",
        "https://rescuro-1.onrender.com",
        "https://rescuro-frontend.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )

