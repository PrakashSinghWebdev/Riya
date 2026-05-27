"""Reminders / scheduling API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core import reminders as store

router = APIRouter(prefix="/reminders", tags=["reminders"])


class ReminderCreate(BaseModel):
    text: str
    due_at: str | None = None  # ISO 8601, e.g. "2026-05-28T15:30:00"


@router.get("")
def list_reminders(include_done: bool = False) -> list[dict]:
    return store.list_all(include_done=include_done)


@router.post("")
def create(body: ReminderCreate) -> dict:
    return store.add(body.text, body.due_at)


@router.get("/due")
def due() -> list[dict]:
    """Reminders that just came due (marks them notified)."""
    return store.due_now()


@router.post("/{reminder_id}/complete")
def complete(reminder_id: int) -> dict:
    if not store.complete(reminder_id):
        raise HTTPException(404, "Reminder not found")
    return {"completed": reminder_id}


@router.delete("/{reminder_id}")
def delete(reminder_id: int) -> dict:
    if not store.delete(reminder_id):
        raise HTTPException(404, "Reminder not found")
    return {"deleted": reminder_id}
