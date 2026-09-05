"""User models and schemas for RESCURO authentication."""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserCreate(BaseModel):
    """User registration schema."""
    email: str = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    role: Optional[str] = "dispatcher"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError("Invalid email address format")
        return cleaned


class UserLogin(BaseModel):
    """User login request schema."""
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    """Public user response schema."""
    id: int
    email: str
    role: str
    created_at: Optional[str] = None


class TokenResponse(BaseModel):
    """JWT response payload."""
    access_token: str
    token_type: str = "bearer"
    user: UserOut
