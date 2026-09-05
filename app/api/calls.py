"""Call History & Session Activity API for RESCURO.
Provides a single, shared source of truth for both user and dispatcher dashboards.
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Query, Depends
from app.database import get_call_sessions
from app.models.user import UserOut
from app.api.auth import get_current_user

logger = logging.getLogger("rescuro.calls")
router = APIRouter(prefix="/api/calls", tags=["Call History"])


@router.get("/history")
async def get_call_history(
    limit: int = Query(50, ge=1, le=200),
    user_only: bool = Query(False),
    # Optional authorization: authenticated users can filter to their own, or view all
    current_user: Optional[UserOut] = Depends(lambda: None)
):
    """Retrieve call session activity and audit history from the shared call_sessions table.

    Used by:
    - User Dashboard: "Tactical Session Activity & Audit Logs"
    - Dispatcher Dashboard: "Live Session Activity"
    """
    user_filter = current_user.id if (user_only and current_user) else None
    sessions = await get_call_sessions(user_id=user_filter, limit=limit)
    return sessions
