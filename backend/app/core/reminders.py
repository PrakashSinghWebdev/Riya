"""Reminders / smart scheduling — persisted in SQLite."""

from __future__ import annotations

from ..db import get_conn


def add(text: str, due_at: str | None = None) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO reminders (text, due_at) VALUES (?, ?)", (text, due_at)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM reminders WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


def list_all(include_done: bool = False) -> list[dict]:
    with get_conn() as conn:
        q = "SELECT * FROM reminders"
        if not include_done:
            q += " WHERE done = 0"
        q += " ORDER BY (due_at IS NULL), due_at ASC, id DESC"
        rows = conn.execute(q).fetchall()
    return [dict(r) for r in rows]


def due_now() -> list[dict]:
    """Reminders whose time has passed and that haven't been notified yet."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM reminders WHERE done = 0 AND notified = 0 "
            "AND due_at IS NOT NULL AND due_at <= datetime('now') ORDER BY due_at ASC"
        ).fetchall()
        ids = [r["id"] for r in rows]
        if ids:
            conn.executemany(
                "UPDATE reminders SET notified = 1 WHERE id = ?", [(i,) for i in ids]
            )
            conn.commit()
    return [dict(r) for r in rows]


def complete(reminder_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("UPDATE reminders SET done = 1 WHERE id = ?", (reminder_id,))
        conn.commit()
    return cur.rowcount > 0


def delete(reminder_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
        conn.commit()
    return cur.rowcount > 0
