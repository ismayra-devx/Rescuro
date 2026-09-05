"""Async SQLite database manager for RESCURO.
Handles table schemas and connection pooling for local development.
"""

import aiosqlite
import logging
from app.config import settings

logger = logging.getLogger("rescuro.database")

_db_initialized = False


async def init_db():
    """Create database tables if they do not already exist."""
    global _db_initialized
    async with aiosqlite.connect(settings.DATABASE_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT DEFAULT 'dispatcher',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()
        _db_initialized = True
        logger.info("RESCURO Database schema initialized successfully.")


async def get_db_connection() -> aiosqlite.Connection:
    """Acquire an active connection to the SQLite database with Row factory enabled."""
    global _db_initialized
    if not _db_initialized:
        await init_db()

    conn = await aiosqlite.connect(settings.DATABASE_PATH)
    conn.row_factory = aiosqlite.Row
    return conn
