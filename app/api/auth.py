"""Authentication routes for RESCURO: Signup, Login, Me, and Token validation.
Supports Supabase Auth as primary backend with transparent local SQLite synchronization.
"""

import logging
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.user import UserCreate, UserLogin, UserOut, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.database import get_db_connection
from app.config import settings

logger = logging.getLogger("rescuro.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)


async def _sync_user_to_sqlite(email: str, password: Optional[str], full_name: Optional[str], role: str) -> Optional[int]:
    """Helper to upsert a Supabase authenticated user into the local SQLite table for local references."""
    try:
        conn = await get_db_connection()
        try:
            cursor = await conn.execute("SELECT id FROM users WHERE email = ?", (email,))
            row = await cursor.fetchone()
            if row:
                user_id = row["id"]
                if full_name:
                    await conn.execute("UPDATE users SET full_name = ?, role = ? WHERE id = ?", (full_name, role, user_id))
                    await conn.commit()
                return user_id
            else:
                dummy_hash = hash_password(password) if password else hash_password("SUPABASE_MANAGED_AUTH")
                cursor = await conn.execute(
                    "INSERT INTO users (email, hashed_password, full_name, role) VALUES (?, ?, ?, ?)",
                    (email, dummy_hash, full_name, role)
                )
                await conn.commit()
                return cursor.lastrowid
        finally:
            await conn.close()
    except Exception as exc:
        logger.warning("Local SQLite user synchronization warning for %s: %s", email, exc)
        return None


async def _resolve_user_from_token(token: str) -> Optional[UserOut]:
    """Helper to validate either a local JWT or a Supabase JWT and return UserOut."""
    # 1. Try local JWT decode
    payload = decode_access_token(token)
    if payload and "sub" in payload:
        user_id = payload["sub"]
        email = payload.get("email")
        # Try finding in SQLite
        conn = await get_db_connection()
        try:
            cursor = await conn.execute(
                "SELECT id, email, full_name, role, created_at FROM users WHERE id = ? OR email = ?",
                (user_id, email or "")
            )
            row = await cursor.fetchone()
            if row:
                return UserOut(
                    id=row["id"],
                    email=row["email"],
                    full_name=row["full_name"],
                    role=row["role"],
                    created_at=str(row["created_at"]) if row["created_at"] else None
                )
        finally:
            await conn.close()

        # If not in SQLite, return directly from token claims
        return UserOut(
            id=user_id,
            email=email or f"user_{user_id}@rescuro.org",
            full_name=payload.get("full_name") or email or "Dispatcher",
            role=payload.get("role") or "dispatcher"
        )

    # 2. If local decode failed, verify if it is a native Supabase access token
    if settings.is_supabase_auth_configured:
        try:
            supabase_url = settings.SUPABASE_URL.rstrip("/")
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{supabase_url}/auth/v1/user",
                    headers={
                        "apikey": settings.supabase_auth_key,
                        "Authorization": f"Bearer {token}"
                    }
                )
            if resp.status_code == 200:
                sb_user = resp.json()
                meta = sb_user.get("user_metadata") or {}
                return UserOut(
                    id=sb_user.get("id"),
                    email=sb_user.get("email", ""),
                    full_name=meta.get("full_name") or sb_user.get("email", "").split("@")[0].capitalize(),
                    role=meta.get("role") or "dispatcher",
                    created_at=str(sb_user.get("created_at") or "")
                )
        except Exception as exc:
            logger.warning("Supabase token validation error: %s", exc)

    return None


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: UserCreate):
    """Register a new account via Supabase Auth (or local SQLite if Supabase is unconfigured)."""
    email = payload.email.strip().lower()
    full_name = payload.full_name or email.split("@")[0].capitalize()
    role = payload.role or "dispatcher"

    # 1. Primary path: Supabase Auth
    if settings.is_supabase_auth_configured:
        supabase_url = settings.SUPABASE_URL.rstrip("/")
        signup_endpoint = f"{supabase_url}/auth/v1/signup"
        headers = {
            "apikey": settings.supabase_auth_key,
            "Content-Type": "application/json",
        }
        sb_payload = {
            "email": email,
            "password": payload.password,
            "data": {
                "full_name": full_name,
                "role": role
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(signup_endpoint, headers=headers, json=sb_payload)

            if resp.status_code in (200, 201):
                data = resp.json()
                user_data = data.get("user") or data
                user_id = user_data.get("id") or f"sb_{email}"
                meta = user_data.get("user_metadata") or {}

                # Sync to SQLite so local tables and FKs recognize this user
                local_id = await _sync_user_to_sqlite(email, payload.password, full_name, role)

                user_out = UserOut(
                    id=local_id or user_id,
                    email=email,
                    full_name=meta.get("full_name") or full_name,
                    role=meta.get("role") or role,
                    created_at=str(user_data.get("created_at") or "")
                )

                token = data.get("access_token") or create_access_token({
                    "sub": str(user_out.id),
                    "email": user_out.email,
                    "full_name": user_out.full_name,
                    "role": user_out.role
                })
                logger.info("Supabase account created successfully for user: %s (id=%s)", email, user_id)
                return TokenResponse(access_token=token, token_type="bearer", user=user_out)

            else:
                err_data = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
                err_msg = err_data.get("msg") or err_data.get("error_description") or err_data.get("message") or resp.text
                logger.warning("Supabase signup rejected for %s (status %d): %s", email, resp.status_code, err_msg)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supabase signup failed: {err_msg}"
                )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Supabase signup connection error for %s: %s", email, exc)

    # 2. Local SQLite fallback (or default when Supabase is not configured)
    logger.info("Registering user %s via local SQLite storage", email)
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
            "INSERT INTO users (email, hashed_password, full_name, role) VALUES (?, ?, ?, ?)",
            (email, hashed, full_name, role)
        )
        await conn.commit()
        user_id = cursor.lastrowid

        cursor = await conn.execute("SELECT id, email, full_name, role, created_at FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        user_out = UserOut(
            id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            role=row["role"],
            created_at=str(row["created_at"]) if row["created_at"] else None
        )

        token = create_access_token({
            "sub": str(user_out.id),
            "email": user_out.email,
            "full_name": user_out.full_name,
            "role": user_out.role
        })
        return TokenResponse(access_token=token, token_type="bearer", user=user_out)
    finally:
        await conn.close()


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    """Authenticate credentials via Supabase Auth API (or local SQLite if Supabase is unconfigured)."""
    email = payload.email.strip().lower()

    # 1. Primary path: Supabase Auth
    if settings.is_supabase_auth_configured:
        supabase_url = settings.SUPABASE_URL.rstrip("/")
        token_endpoint = f"{supabase_url}/auth/v1/token?grant_type=password"
        headers = {
            "apikey": settings.supabase_auth_key,
            "Content-Type": "application/json",
        }
        sb_payload = {
            "email": email,
            "password": payload.password
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(token_endpoint, headers=headers, json=sb_payload)

            if resp.status_code == 200:
                data = resp.json()
                user_data = data.get("user") or {}
                meta = user_data.get("user_metadata") or {}
                user_id = user_data.get("id") or f"sb_{email}"
                full_name = meta.get("full_name") or email.split("@")[0].capitalize()
                role = meta.get("role") or "dispatcher"

                # Sync to SQLite so local foreign keys (call_sessions.user_id) recognize this user
                local_id = await _sync_user_to_sqlite(email, payload.password, full_name, role)

                user_out = UserOut(
                    id=local_id or user_id,
                    email=email,
                    full_name=full_name,
                    role=role,
                    created_at=str(user_data.get("created_at") or "")
                )

                token = data.get("access_token") or create_access_token({
                    "sub": str(user_out.id),
                    "email": user_out.email,
                    "full_name": user_out.full_name,
                    "role": user_out.role
                })
                logger.info("Supabase authentication successful for user: %s (id=%s)", email, user_id)
                return TokenResponse(access_token=token, token_type="bearer", user=user_out)

            else:
                err_data = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
                err_msg = err_data.get("error_description") or err_data.get("msg") or err_data.get("message") or resp.text
                logger.warning("Supabase auth failed for %s (status %d): %s", email, resp.status_code, err_msg)

                # Check local SQLite in case this is a pre-seeded developer/test account
                conn = await get_db_connection()
                try:
                    cursor = await conn.execute(
                        "SELECT id, email, hashed_password, full_name, role, created_at FROM users WHERE email = ?",
                        (email,)
                    )
                    row = await cursor.fetchone()
                    if row and verify_password(payload.password, row["hashed_password"]):
                        logger.info("Local SQLite authentication successful for user %s after Supabase 401", email)
                        user_out = UserOut(
                            id=row["id"],
                            email=row["email"],
                            full_name=row["full_name"],
                            role=row["role"],
                            created_at=str(row["created_at"]) if row["created_at"] else None
                        )
                        token = create_access_token({
                            "sub": str(user_out.id),
                            "email": user_out.email,
                            "full_name": user_out.full_name,
                            "role": user_out.role
                        })
                        return TokenResponse(access_token=token, token_type="bearer", user=user_out)
                finally:
                    await conn.close()

                # Raise 401 with explicit Supabase reason
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Supabase auth failed: {err_msg}" if err_msg else "Invalid email or password"
                )

        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Supabase auth connection error for %s: %s", email, exc)

    # 2. Local SQLite fallback when Supabase is not configured
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id, email, hashed_password, full_name, role, created_at FROM users WHERE email = ?",
            (email,)
        )
        row = await cursor.fetchone()
        if not row or not verify_password(payload.password, row["hashed_password"]):
            logger.warning("Local SQLite login failed: Invalid email or password for %s (Supabase not configured)", email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        user_out = UserOut(
            id=row["id"],
            email=row["email"],
            full_name=row["full_name"],
            role=row["role"],
            created_at=str(row["created_at"]) if row["created_at"] else None
        )

        token = create_access_token({
            "sub": str(user_out.id),
            "email": user_out.email,
            "full_name": user_out.full_name,
            "role": user_out.role
        })
        logger.info("Local SQLite login successful for %s", email)
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

    user = await _resolve_user_from_token(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token"
        )
    return user


@router.get("/me", response_model=UserOut)
async def get_me(current_user: UserOut = Depends(get_current_user)):
    """Retrieve authenticated user's profile."""
    return current_user


async def authenticate_ws_token(token: str) -> UserOut:
    """Validate a raw token string (e.g. from WebSocket query parameter) and return UserOut."""
    if not token:
        raise ValueError("Missing token")

    user = await _resolve_user_from_token(token)
    if not user:
        raise ValueError("Invalid or expired token")
    return user
