"""Authentication routes for RESCURO: Signup, Login, and Token validation."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import UserCreate, UserLogin, UserOut, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.database import get_db_connection

logger = logging.getLogger("rescuro.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: UserCreate):
    """Register a new dispatcher account and return an access token."""
    email = payload.email.strip().lower()
    hashed = hash_password(payload.password)

    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT id FROM users WHERE email = ?", (email,))
        existing = await cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists"
            )

        cursor = await conn.execute(
            "INSERT INTO users (email, hashed_password, role) VALUES (?, ?, ?)",
            (email, hashed, payload.role or "dispatcher")
        )
        await conn.commit()
        user_id = cursor.lastrowid

        # Fetch created user
        cursor = await conn.execute("SELECT id, email, role, created_at FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        user_out = UserOut(
            id=row["id"],
            email=row["email"],
            role=row["role"],
            created_at=str(row["created_at"]) if row["created_at"] else None
        )

        token = create_access_token({"sub": str(user_out.id), "email": user_out.email, "role": user_out.role})
        return TokenResponse(access_token=token, token_type="bearer", user=user_out)
    finally:
        await conn.close()


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    """Authenticate dispatcher credentials and issue an access token."""
    email = payload.email.strip().lower()

    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id, email, hashed_password, role, created_at FROM users WHERE email = ?",
            (email,)
        )
        row = await cursor.fetchone()
        if not row or not verify_password(payload.password, row["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        user_out = UserOut(
            id=row["id"],
            email=row["email"],
            role=row["role"],
            created_at=str(row["created_at"]) if row["created_at"] else None
        )

        token = create_access_token({"sub": str(user_out.id), "email": user_out.email, "role": user_out.role})
        return TokenResponse(access_token=token, token_type="bearer", user=user_out)
    finally:
        await conn.close()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserOut:
    """Dependency to extract and validate the authenticated user from the Authorization header."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials"
        )
    
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token"
        )

    user_id = int(payload["sub"])
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT id, email, role, created_at FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found")
        return UserOut(
            id=row["id"],
            email=row["email"],
            role=row["role"],
            created_at=str(row["created_at"]) if row["created_at"] else None
        )
    finally:
        await conn.close()


async def authenticate_ws_token(token: str) -> UserOut:
    """Validate a raw token string (e.g. from WebSocket query parameter) and return UserOut."""
    if not token:
        raise ValueError("Missing token")
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise ValueError("Invalid or expired token")

    user_id = int(payload["sub"])
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT id, email, role, created_at FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        if not row:
            raise ValueError("User not found")
        return UserOut(
            id=row["id"],
            email=row["email"],
            role=row["role"],
            created_at=str(row["created_at"]) if row["created_at"] else None
        )
    finally:
        await conn.close()
