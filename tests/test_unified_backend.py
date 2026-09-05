"""Automated tests for RESCURO Backend Authentication & Calls History.
Verifies auth, /api/auth/me, full_name retrieval, and GET /api/calls/history.
"""

import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_auth_me_and_full_name():
    """Verify registration with full_name and retrieval via /api/auth/me."""
    email = f"officer_{int(time.time() * 1000)}@rescuro.org"
    password = "SecurePassword123!"
    full_name = "Officer Sarah Connor"

    # Signup
    signup_resp = client.post("/api/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": full_name,
        "role": "responder"
    })
    assert signup_resp.status_code == 201
    signup_data = signup_resp.json()
    assert "access_token" in signup_data
    token = signup_data["access_token"]
    assert signup_data["user"]["full_name"] == full_name

    # /api/auth/me
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == email
    assert me_data["full_name"] == full_name


def test_calls_history_endpoint():
    """Verify GET /api/calls/history returns a list of recorded call sessions."""
    history_resp = client.get("/api/calls/history")
    assert history_resp.status_code == 200
    data = history_resp.json()
    assert isinstance(data, list)
