"""FastAPI Application entrypoint for RESCURO Command Center Backend."""

from contextlib import asynccontextmanager
import logging
from typing import List

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.database import create_user, get_call_logs_by_user, get_user_by_email, init_db
from app.models import CallLogOut, Token, UserLogin, UserOut, UserSignup
from app.ws_call import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("command_center")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes SQLite schema on startup."""
    logger.info("Initializing RESCURO Command Center backend...")
    init_db()
    yield
    logger.info("RESCURO Command Center backend shut down cleanly.")


def create_app() -> FastAPI:
    """Configures and builds the FastAPI application."""
    app = FastAPI(
        title="RESCURO Command Center API",
        description="Standalone backend providing authentication, call logging, and voice AI streaming.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Allow CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register WebSocket call streaming route
    app.include_router(ws_router)

    # Health Check Endpoints
    @app.get("/health", tags=["Health"])
    @app.get("/api/health", tags=["Health"])
    async def health_check():
        return {
            "status": "ok",
            "service": "rescuro-command-center-backend",
            "version": "1.0.0",
        }

    # Authentication Endpoints
    @app.post(
        "/api/auth/signup",
        response_model=Token,
        status_code=status.HTTP_201_CREATED,
        tags=["Authentication"],
    )
    async def signup(body: UserSignup):
        existing = get_user_by_email(body.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists.",
            )

        hashed_pw = hash_password(body.password)
        new_user = create_user(
            email=body.email,
            password_hash=hashed_pw,
            full_name=body.full_name,
        )

        token = create_access_token(data={"sub": str(new_user["id"]), "email": new_user["email"]})
        return Token(
            access_token=token,
            token_type="bearer",
            user=UserOut(
                id=new_user["id"],
                email=new_user["email"],
                full_name=new_user["full_name"],
                created_at=new_user["created_at"],
            ),
        )

    @app.post("/api/auth/login", response_model=Token, tags=["Authentication"])
    async def login(body: UserLogin):
        user = get_user_by_email(body.email)
        if not user or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(data={"sub": str(user["id"]), "email": user["email"]})
        return Token(
            access_token=token,
            token_type="bearer",
            user=UserOut(
                id=user["id"],
                email=user["email"],
                full_name=user["full_name"],
                created_at=user["created_at"],
            ),
        )

    @app.get("/api/auth/me", response_model=UserOut, tags=["Authentication"])
    async def get_current_user_profile(user: dict = Depends(get_current_user)):
        return UserOut(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            created_at=user["created_at"],
        )

    # Call Activity Endpoints
    @app.get("/api/calls/history", response_model=List[CallLogOut], tags=["Calls"])
    async def get_call_history(user: dict = Depends(get_current_user)):
        logs = get_call_logs_by_user(user_id=user["id"], limit=20)
        return [
            CallLogOut(
                id=l["id"],
                user_id=l["user_id"],
                start_time=l["start_time"],
                end_time=l.get("end_time"),
                duration_sec=l.get("duration_sec", 0),
                status=l.get("status", "completed"),
                created_at=l["created_at"],
            )
            for l in logs
        ]

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
