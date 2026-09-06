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
                email = sb_user.get("email", "")
                full_name = meta.get("full_name") or (email.split("@")[0].capitalize() if email else "Dispatcher")
                role = meta.get("role") or "dispatcher"

                # Check SQLite to see if we have local integer ID to keep local relational FKs intact
                local_id = None
                try:
                    conn = await get_db_connection()
                    try:
                        cursor = await conn.execute("SELECT id FROM users WHERE email = ?", (email,))
                        row = await cursor.fetchone()
                        if row:
                            local_id = row["id"]
                    finally:
                        await conn.close()
                except Exception:
                    pass

                return UserOut(
                    id=local_id or sb_user.get("id"),
                    email=email,
                    full_name=full_name,
                    role=role,
                    created_at=str(sb_user.get("created_at") or "")
                )
            else:
                logger.warning("Supabase user validation failed (status %d): %s", resp.status_code, resp.text)
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
                err_code = err_data.get("error_code") or err_data.get("code") or err_data.get("error")

                # Diagnostic: Check if Supabase rejected due to unconfirmed email
                is_unconfirmed = bool(
                    "not confirmed" in str(err_msg).lower()
                    or "unconfirmed" in str(err_msg).lower()
                    or str(err_code).lower() == "email_not_confirmed"
                )

                # If generic 'Invalid login credentials', query Supabase Admin API (if service key available) to inspect confirmation state
                service_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_SERVICE_KEY
                if service_key and not is_unconfirmed:
                    try:
                        admin_url = f"{supabase_url}/auth/v1/admin/users"
                        admin_headers = {
                            "apikey": service_key,
                            "Authorization": f"Bearer {service_key}"
                        }
                        async with httpx.AsyncClient(timeout=5.0) as admin_client:
                            admin_resp = await admin_client.get(admin_url, headers=admin_headers, params={"page": 1, "per_page": 50})
                        if admin_resp.status_code == 200:
                            data_body = admin_resp.json()
                            u_list = data_body.get("users", []) if isinstance(data_body, dict) else (data_body if isinstance(data_body, list) else [])
                            for u in u_list:
                                if u.get("email", "").strip().lower() == email:
                                    if not u.get("email_confirmed_at") and not u.get("confirmed_at"):
                                        is_unconfirmed = True
                                        logger.warning(
                                            "Supabase auth diagnostic: User %s exists in Supabase (id=%s) but email is UNCONFIRMED (email_confirmed_at=None). Supabase password grant masked this as '%s'.",
                                            email, u.get("id"), err_msg
                                        )
                                    else:
                                        logger.warning(
                                            "Supabase auth diagnostic: User %s exists in Supabase (id=%s) and email is confirmed, but password verification failed.",
                                            email, u.get("id")
                                        )
                                    break
                    except Exception as admin_exc:
                        logger.debug("Supabase admin lookup check warning: %s", admin_exc)

                if is_unconfirmed:
                    logger.warning(
                        "Supabase auth rejection for %s: Email is not confirmed. User must confirm email before logging in. (Supabase error: %s)",
                        email, err_msg
                    )
                    detail_msg = "Email not confirmed. Please check your email inbox for the confirmation link or confirm your account in the Supabase dashboard."
                else:
                    logger.warning("Supabase auth failed for %s (status %d): %s", email, resp.status_code, err_msg)
                    detail_msg = f"Supabase auth failed: {err_msg}" if err_msg else "Invalid email or password"

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

                # Raise 401 with explicit reason (unconfirmed email vs invalid credentials)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=detail_msg
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


ALLOWED_SUPERVISOR_ROLES = {"supervisor", "lead_dispatcher", "dispatcher", "admin"}


async def get_current_supervisor(current_user: UserOut = Depends(get_current_user)) -> UserOut:
    """Dependency enforcing that the authenticated user holds an authorized supervisor or dispatcher role."""
    role = (current_user.role or "").strip().lower()
    if role not in ALLOWED_SUPERVISOR_ROLES:
        logger.warning(
            "Takeover authorization rejected for user %s with role '%s'. Required roles: %s",
            current_user.email, current_user.role, ALLOWED_SUPERVISOR_ROLES
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Role '{current_user.role}' is not authorized to perform call takeover. Required: supervisor or dispatcher."
        )
    return current_user


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
