"""Async SQLite database manager for RESCURO.
Maintains unified database schema for users and call_sessions.
"""

import aiosqlite
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from app.config import settings

logger = logging.getLogger("rescuro.database")

_db_initialized = False


async def init_db():
    """Create database tables if they do not already exist."""
    global _db_initialized
    async with aiosqlite.connect(settings.DATABASE_PATH, timeout=30.0) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA busy_timeout=30000;")
        # 1. Users Table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                full_name TEXT,
                role TEXT DEFAULT 'dispatcher',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migration: ensure full_name column exists if table was previously created
        try:
            await db.execute("ALTER TABLE users ADD COLUMN full_name TEXT")
            await db.commit()
        except Exception:
            pass  # Column already exists

        # 2. Shared Call Sessions Table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS call_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_id TEXT UNIQUE NOT NULL,
                user_id INTEGER,
                caller_name TEXT,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                duration_sec INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                transcript TEXT DEFAULT '',
                source TEXT DEFAULT 'vobiz', -- 'vobiz' or 'dashboard_call'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)
        await db.commit()
        _db_initialized = True
        logger.info("RESCURO Database schema (users, call_sessions) initialized successfully.")


async def get_db_connection() -> aiosqlite.Connection:
    """Acquire an active connection to the SQLite database with Row factory enabled."""
    global _db_initialized
    if not _db_initialized:
        await init_db()

    conn = await aiosqlite.connect(settings.DATABASE_PATH, timeout=30.0)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA busy_timeout=30000;")
    return conn


# ==============================================================================
# Call Sessions Helpers
# ==============================================================================

async def create_call_session(
    call_id: str,
    user_id: Optional[int] = None,
    caller_name: Optional[str] = None,
    source: str = "dashboard_call",
    status: str = "active",
    start_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """Create a new call session entry in the database."""
    now_dt = start_time or datetime.now(timezone.utc)
    start_iso = now_dt.isoformat()

    conn = await get_db_connection()
    try:
        await conn.execute(
            """
            INSERT OR REPLACE INTO call_sessions 
            (call_id, user_id, caller_name, start_time, status, source)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (call_id, user_id, caller_name, start_iso, status, source)
        )
        await conn.commit()
        return {
            "call_id": call_id,
            "user_id": user_id,
            "caller_name": caller_name,
            "start_time": start_iso,
            "status": status,
            "source": source
        }
    finally:
        await conn.close()


async def update_call_session(
    call_id: str,
    end_time: Optional[datetime] = None,
    duration_sec: Optional[int] = None,
    status: Optional[str] = None,
    transcript: Optional[str] = None
):
    """Update call session status, end time, duration, or transcript."""
    conn = await get_db_connection()
    try:
        updates = []
        params = []

        if end_time is not None:
            updates.append("end_time = ?")
            params.append(end_time.isoformat())

        if duration_sec is not None:
            updates.append("duration_sec = ?")
            params.append(duration_sec)

        if status is not None:
            updates.append("status = ?")
            params.append(status)

        if transcript is not None:
            updates.append("transcript = ?")
            params.append(transcript)

        if updates:
            params.append(call_id)
            query = f"UPDATE call_sessions SET {', '.join(updates)} WHERE call_id = ?"
            await conn.execute(query, tuple(params))
            await conn.commit()
    finally:
        await conn.close()


async def append_call_transcript(call_id: str, text_chunk: str):
    """Append text to the ongoing call session's transcript."""
    if not text_chunk or not text_chunk.strip():
        return
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT transcript FROM call_sessions WHERE call_id = ?", (call_id,))
        row = await cursor.fetchone()
        existing = row["transcript"] if row and row["transcript"] else ""
        new_transcript = f"{existing} {text_chunk.strip()}".strip()
        await conn.execute(
            "UPDATE call_sessions SET transcript = ? WHERE call_id = ?",
            (new_transcript, call_id)
        )
        await conn.commit()
    finally:
        await conn.close()


async def get_call_sessions(user_id: Optional[int] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve call history ordered by latest first."""
    conn = await get_db_connection()
    try:
        if user_id is not None:
            cursor = await conn.execute(
                """
                SELECT id, call_id, user_id, caller_name, start_time, end_time,
                       duration_sec, status, transcript, source, created_at
                FROM call_sessions
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (user_id, limit)
            )
        else:
            cursor = await conn.execute(
                """
                SELECT id, call_id, user_id, caller_name, start_time, end_time,
                       duration_sec, status, transcript, source, created_at
                FROM call_sessions
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,)
            )

        rows = await cursor.fetchall()
        results = []
        for r in rows:
            results.append({
                "id": r["call_id"],
                "call_id": r["call_id"],
                "user_id": r["user_id"],
                "caller": r["caller_name"] or "Unknown",
                "caller_name": r["caller_name"] or "Unknown",
                "start_time": r["start_time"],
                "end_time": r["end_time"],
                "duration_sec": r["duration_sec"] or 0,
                "duration": f"{r['duration_sec'] // 60:02d}m {r['duration_sec'] % 60:02d}s" if r["duration_sec"] else "00m 00s",
                "status": r["status"] or "completed",
                "transcript": r["transcript"] or "",
                "source": r["source"] or "dashboard_call",
                "created_at": r["created_at"]
            })
        return results
    finally:
        await conn.close()
