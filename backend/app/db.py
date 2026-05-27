"""SQLite persistence layer for RIYA.

Uses the Python stdlib `sqlite3` — no external service required. Connections
are opened per-call (FastAPI runs sync endpoints in a threadpool, so sharing a
single connection across threads would be unsafe). A vector store (ChromaDB /
FAISS) can be layered alongside this when semantic recall at scale is needed.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from collections.abc import Iterator

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    mode        TEXT NOT NULL DEFAULT 'normal',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,            -- user | assistant
    content     TEXT NOT NULL,
    emotion     TEXT,                     -- detected mood for user turns
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

-- Long-term memory: facts RIYA remembers about the user.
CREATE TABLE IF NOT EXISTS facts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,            -- preference | routine | fact | emotional | skill
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    weight      REAL NOT NULL DEFAULT 1.0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(kind, key)
);

-- Persistent app/user preferences (active mode, voice on/off, etc.).
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reminders / scheduled items.
CREATE TABLE IF NOT EXISTS reminders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    text        TEXT NOT NULL,
    due_at      TEXT,                     -- ISO 8601; null = no specific time
    done        INTEGER NOT NULL DEFAULT 0,
    notified    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at);
"""

# Bump when SCHEMA changes in a way that needs a migration. Stored via
# PRAGMA user_version so future versions can detect and upgrade old databases.
SCHEMA_VERSION = 2


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        conn.commit()


def schema_version() -> int:
    with get_conn() as conn:
        return conn.execute("PRAGMA user_version").fetchone()[0]


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(settings.db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()
