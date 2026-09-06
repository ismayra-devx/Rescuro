"""Comprehensive tests for RESCURO authentication, token resolution, and error diagnostics."""

import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.api.auth import _resolve_user_from_token

client = TestClient(app)


def test_signup_and_login_flow():
    """Verify signup creates user and subsequent login returns access_token and user profile."""
    email = f"officer_auth_diag_{int(time.time() * 1000)}@rescuro.org"
    password = "SuperSecretPassword123!"
    full_name = "Chief Inspector Test"

    # 1. Signup
    signup_resp = client.post("/api/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": full_name,
        "role": "supervisor"
    })
    assert signup_resp.status_code == 201
    signup_data = signup_resp.json()
    assert "access_token" in signup_data
    assert signup_data["user"]["email"] == email

    # 2. Login with correct credentials
    login_resp = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    token = login_data["access_token"]
    assert login_data["user"]["email"] == email
    assert login_data["user"]["role"] == "supervisor"

    # 3. Verify GET /api/auth/me using token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == email
    assert me_data["full_name"] == full_name


def test_login_invalid_credentials():
    """Verify login with invalid password returns 401."""
    email = f"officer_invalid_{int(time.time() * 1000)}@rescuro.org"
    password = "CorrectPassword123!"

    # Signup first
    client.post("/api/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": "Test User",
        "role": "dispatcher"
    })

    # Try login with wrong password
    bad_login = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPasswordXYZ!"
    })
    assert bad_login.status_code == 401
    assert "detail" in bad_login.json()


@pytest.mark.asyncio
async def test_resolve_user_from_local_token():
    """Verify _resolve_user_from_token correctly extracts user from signed local JWT."""
    token = create_access_token({
        "sub": "999",
        "email": "token_test@rescuro.org",
        "full_name": "Token Tester",
        "role": "supervisor"
    })

    user = await _resolve_user_from_token(token)
    assert user is not None
    assert user.email == "token_test@rescuro.org"
    assert user.role == "supervisor"


def test_get_me_without_bearer_token():
    """Verify GET /api/auth/me rejects requests without token with 401."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
