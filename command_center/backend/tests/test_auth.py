"""Unit and integration tests for RESCURO Command Center authentication."""

import os
import uuid
import pytest
from fastapi.testclient import TestClient

from app.database import init_db
from app.main import create_app


@pytest.fixture(autouse=True)
def setup_teardown_db():
    db_file = f"test_auth_{uuid.uuid4().hex[:8]}.db"
    os.environ["DATABASE_PATH"] = db_file
    init_db(db_file)
    yield
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass


def test_health_check():
    app = create_app()
    client = TestClient(app)
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_signup_and_login_flow():
    app = create_app()
    client = TestClient(app)

    # 1. Signup
    signup_data = {
        "email": "commander@rescuro.org",
        "password": "securepassword123",
        "full_name": "Commander Shepard",
    }
    res_signup = client.post("/api/auth/signup", json=signup_data)
    assert res_signup.status_code == 201
    signup_json = res_signup.json()
    assert "access_token" in signup_json
    assert signup_json["user"]["email"] == "commander@rescuro.org"
    assert signup_json["user"]["full_name"] == "Commander Shepard"

    # 2. Duplicate signup fails
    res_dup = client.post("/api/auth/signup", json=signup_data)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"]

    # 3. Login with correct password
    login_data = {
        "email": "commander@rescuro.org",
        "password": "securepassword123",
    }
    res_login = client.post("/api/auth/login", json=login_data)
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    assert token is not None

    # 4. Login with incorrect password fails
    bad_login = {
        "email": "commander@rescuro.org",
        "password": "wrongpassword",
    }
    res_bad = client.post("/api/auth/login", json=bad_login)
    assert res_bad.status_code == 401

    # 5. Access protected /api/auth/me
    res_me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "commander@rescuro.org"

    # 6. Access protected route without token fails
    res_unauth = client.get("/api/auth/me")
    assert res_unauth.status_code == 401
