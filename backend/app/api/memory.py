"""Memory API — sessions, message history, and long-term facts."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..core import memory as store

router = APIRouter(prefix="/memory", tags=["memory"])


# ── Sessions ──────────────────────────────────────────────────────
class SessionCreate(BaseModel):
    title: str | None = None
    mode: str = "normal"


@router.get("/sessions")
def list_sessions(limit: int = 50) -> list[dict]:
    return store.list_sessions(limit=limit)


@router.post("/sessions")
def create_session(body: SessionCreate) -> dict:
    return store.create_session(title=body.title, mode=body.mode)


@router.get("/sessions/{session_id}")
def get_session(session_id: str) -> dict:
    s = store.get_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: str, limit: int = 100) -> list[dict]:
    if not store.get_session(session_id):
        raise HTTPException(404, "Session not found")
    return store.get_messages(session_id, limit=limit)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str) -> dict:
    if not store.delete_session(session_id):
        raise HTTPException(404, "Session not found")
    return {"deleted": session_id}


# ── Facts (long-term memory) ──────────────────────────────────────
class FactUpsert(BaseModel):
    kind: str = Field(..., description="preference|routine|fact|emotional|skill")
    key: str
    value: str
    weight: float = 1.0


@router.get("/facts")
def list_facts(kind: str | None = None) -> list[dict]:
    return store.list_facts(kind=kind)


@router.post("/facts")
def upsert_fact(body: FactUpsert) -> dict:
    try:
        return store.upsert_fact(body.kind, body.key, body.value, body.weight)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.delete("/facts/{fact_id}")
def delete_fact(fact_id: int) -> dict:
    if not store.delete_fact(fact_id):
        raise HTTPException(404, "Fact not found")
    return {"deleted": fact_id}


@router.get("/recall")
def recall(q: str = "", max_facts: int = 8) -> dict:
    """Preview the memory context RIYA would inject for a given query."""
    return {"query": q, "context": store.recall_context(q, max_facts=max_facts)}


# ── Emotional memory ──────────────────────────────────────────────
@router.get("/emotions")
def emotions(session_id: str | None = None, limit: int = 50) -> dict:
    """Recent emotion timeline + aggregate summary (RIYA's emotional memory)."""
    return {
        "timeline": store.emotion_timeline(session_id, limit),
        "summary": store.emotion_summary(session_id, limit),
    }
