"""RIYA memory system.

Backed by SQLite (`app.db`). Provides:
  - Sessions + message history (short-term / conversational memory)
  - Long-term facts about the user (preferences, routines, skills, emotional)
  - Recall: assemble a compact memory context to prime the brain each turn

Recall currently uses recency + simple keyword overlap. A vector index can
slot in behind `recall_context()` later without changing callers.
"""

from __future__ import annotations

import re
import uuid

from ..db import get_conn

# Memory kinds correspond to the PRD's memory taxonomy.
FACT_KINDS = {"preference", "routine", "fact", "emotional", "skill"}
_WORD_RE = re.compile(r"[a-z0-9]+")


# ── Sessions ──────────────────────────────────────────────────────
def create_session(title: str | None = None, mode: str = "normal") -> dict:
    sid = uuid.uuid4().hex
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (id, title, mode) VALUES (?, ?, ?)",
            (sid, title or "New session", mode),
        )
        conn.commit()
    return get_session(sid)


def get_session(session_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
    return dict(row) if row else None


def list_sessions(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


def delete_session(session_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
    return cur.rowcount > 0


def ensure_session(session_id: str | None, mode: str = "normal") -> str:
    """Return a valid session id, creating one if needed."""
    if session_id and get_session(session_id):
        return session_id
    return create_session(mode=mode)["id"]


# ── Messages ──────────────────────────────────────────────────────
def add_message(
    session_id: str, role: str, content: str, emotion: str | None = None
) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO messages (session_id, role, content, emotion) "
            "VALUES (?, ?, ?, ?)",
            (session_id, role, content, emotion),
        )
        conn.execute(
            "UPDATE sessions SET updated_at = datetime('now') WHERE id = ?",
            (session_id,),
        )
        # Auto-title a still-unnamed session from its first user message.
        if role == "user":
            conn.execute(
                """
                UPDATE sessions SET title = ?
                WHERE id = ? AND (title IS NULL OR title IN ('', 'New session'))
                """,
                (content[:60], session_id),
            )
        conn.commit()
    return cur.lastrowid


def get_messages(session_id: str, limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, role, content, emotion, created_at FROM messages "
            "WHERE session_id = ? ORDER BY id ASC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


# ── Facts (long-term memory) ──────────────────────────────────────
def upsert_fact(kind: str, key: str, value: str, weight: float = 1.0) -> dict:
    if kind not in FACT_KINDS:
        raise ValueError(f"Unknown fact kind '{kind}'. Allowed: {sorted(FACT_KINDS)}")
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO facts (kind, key, value, weight) VALUES (?, ?, ?, ?)
            ON CONFLICT(kind, key) DO UPDATE SET
                value = excluded.value,
                weight = excluded.weight,
                updated_at = datetime('now')
            """,
            (kind, key, value, weight),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM facts WHERE kind = ? AND key = ?", (kind, key)
        ).fetchone()
    return dict(row)


def list_facts(kind: str | None = None) -> list[dict]:
    with get_conn() as conn:
        if kind:
            rows = conn.execute(
                "SELECT * FROM facts WHERE kind = ? ORDER BY weight DESC, updated_at DESC",
                (kind,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM facts ORDER BY weight DESC, updated_at DESC"
            ).fetchall()
    return [dict(r) for r in rows]


def delete_fact(fact_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM facts WHERE id = ?", (fact_id,))
        conn.commit()
    return cur.rowcount > 0


# ── Emotional memory ──────────────────────────────────────────────
def emotion_timeline(session_id: str | None = None, limit: int = 50) -> list[dict]:
    """Recent detected emotions (user turns), newest first. Optionally scoped
    to a session. This is RIYA's 'emotional memory'."""
    with get_conn() as conn:
        if session_id:
            rows = conn.execute(
                "SELECT emotion, created_at, session_id FROM messages "
                "WHERE role = 'user' AND emotion IS NOT NULL AND session_id = ? "
                "ORDER BY id DESC LIMIT ?",
                (session_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT emotion, created_at, session_id FROM messages "
                "WHERE role = 'user' AND emotion IS NOT NULL "
                "ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def emotion_summary(session_id: str | None = None, limit: int = 50) -> dict:
    """Aggregate recent emotions into counts + the dominant mood."""
    timeline = emotion_timeline(session_id, limit)
    counts: dict[str, int] = {}
    for r in timeline:
        counts[r["emotion"]] = counts.get(r["emotion"], 0) + 1
    dominant = max(counts, key=counts.get) if counts else "neutral"
    return {"dominant": dominant, "counts": counts, "samples": len(timeline)}


# ── Settings (persistent preferences) ─────────────────────────────
def get_setting(key: str, default: str | None = None) -> str | None:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                updated_at = datetime('now')
            """,
            (key, value),
        )
        conn.commit()


def all_settings() -> dict[str, str]:
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {r["key"]: r["value"] for r in rows}


# ── Recall ────────────────────────────────────────────────────────
def _tokens(text: str) -> set[str]:
    return set(_WORD_RE.findall(text.lower()))


def recall_context(query: str = "", max_facts: int = 8) -> str:
    """Assemble a compact 'what RIYA remembers' block for the system prompt.

    Facts are ranked by keyword overlap with `query`, then by weight. With no
    query, the highest-weighted facts are returned.
    """
    facts = list_facts()
    if not facts:
        return ""

    q = _tokens(query)
    if q:
        def score(f: dict) -> tuple[float, float]:
            overlap = len(q & _tokens(f["key"] + " " + f["value"]))
            return (overlap, f["weight"])

        facts.sort(key=score, reverse=True)

    top = facts[:max_facts]
    lines = [f"- ({f['kind']}) {f['key']}: {f['value']}" for f in top]
    return "What you remember about the user:\n" + "\n".join(lines)
