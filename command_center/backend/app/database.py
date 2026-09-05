"""SQLite database initialization and access methods for RESCURO Command Center."""

import os
import sqlite3
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from app.config import settings

logger = logging.getLogger("command_center.database")


def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Returns a SQLite connection with dict-like row access."""
    path = db_path or os.getenv("DATABASE_PATH") or settings.DATABASE_PATH
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    """Creates database schema tables if they do not exist."""
    path = db_path or os.getenv("DATABASE_PATH") or settings.DATABASE_PATH
    conn = get_db_connection(path)
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS call_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    duration_sec INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'completed',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);")
        logger.info(f"Initialized SQLite database schema at {path}")
    finally:
        conn.close()


def create_user(email: str, password_hash: str, full_name: str, db_path: Optional[str] = None) -> Dict[str, Any]:
    """Inserts a new user record into database."""
    conn = get_db_connection(db_path)
    now = datetime.now(timezone.utc).isoformat()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO users (email, password_hash, full_name, created_at) VALUES (?, ?, ?, ?)",
                (email.lower().strip(), password_hash, full_name.strip(), now),
            )
            user_id = cursor.lastrowid
        return {
            "id": user_id,
            "email": email.lower().strip(),
            "full_name": full_name.strip(),
            "created_at": now,
        }
    finally:
        conn.close()


def get_user_by_email(email: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieves user row by email."""
    conn = get_db_connection(db_path)
    try:
        cur = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: int, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieves user row by ID."""
    conn = get_db_connection(db_path)
    try:
        cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def add_call_log(
    user_id: int,
    start_time: str,
    end_time: Optional[str] = None,
    duration_sec: int = 0,
    status: str = "completed",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Inserts a call log record."""
    conn = get_db_connection(db_path)
    now = datetime.now(timezone.utc).isoformat()
    try:
        with conn:
            cur = conn.execute(
                """INSERT INTO call_logs (user_id, start_time, end_time, duration_sec, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (user_id, start_time, end_time, duration_sec, status, now),
            )
            call_id = cur.lastrowid
        return {
            "id": call_id,
            "user_id": user_id,
            "start_time": start_time,
            "end_time": end_time,
            "duration_sec": duration_sec,
            "status": status,
            "created_at": now,
        }
    finally:
        conn.close()


def get_call_logs_by_user(user_id: int, limit: int = 20, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves latest call logs for user ordered by ID descending."""
    conn = get_db_connection(db_path)
    try:
        cur = conn.execute(
            """SELECT * FROM call_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?""",
            (user_id, limit),
        )
        return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()
