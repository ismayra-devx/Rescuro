"""Pydantic request and response schemas for RESCURO Command Center."""

from datetime import datetime
from typing import Optional
import re
from pydantic import BaseModel, Field, field_validator


class UserSignup(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    full_name: str = Field(..., min_length=2, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email format")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    created_at: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CallLogCreate(BaseModel):
    user_id: int
    start_time: str
    end_time: Optional[str] = None
    duration_sec: int = 0
    status: str = "completed"


class CallLogOut(BaseModel):
    id: int
    user_id: int
    start_time: str
    end_time: Optional[str] = None
    duration_sec: int
    status: str
    created_at: str
