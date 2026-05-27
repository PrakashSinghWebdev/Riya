"""Chat endpoint — the conversational entry point to the RIYA brain.

Each turn: detect the user's emotion, recall relevant long-term memory, prime
the brain with both, and (optionally) persist the exchange to a session.
"""

from __future__ import annotations

import json
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..core import emotion as emotion_engine
from ..core import memory as memory_store
from ..core.brain import brain
from ..core.modes import get_mode

router = APIRouter(tags=["chat"])


class Message(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[Message] = Field(..., min_length=1)
    mode: str | None = None
    # When provided, the exchange is persisted to this session (created if absent).
    session_id: str | None = None
    # Whether to recall long-term facts + adapt to detected emotion. Default on.
    use_memory: bool = True
    use_emotion: bool = True


class ChatResponse(BaseModel):
    reply: str
    mode: str
    online: bool
    emotion: str | None = None
    session_id: str | None = None


def _prepare(req: ChatRequest) -> tuple[list[dict], str, str, str | None]:
    """Build (history, memory_context, tone, detected_emotion) for a request."""
    history = [m.model_dump() for m in req.messages]
    last_user = next(
        (m["content"] for m in reversed(history) if m["role"] == "user"), ""
    )

    detected = None
    tone = ""
    if req.use_emotion and last_user:
        result = emotion_engine.detect(last_user)
        detected = result.emotion
        tone = result.tone

    memory_context = ""
    if req.use_memory:
        memory_context = memory_store.recall_context(last_user)

    return history, memory_context, tone, detected


def _persist(req: ChatRequest, user_text: str, reply: str, emotion: str | None) -> str | None:
    """Store the user + assistant turns if a session context was requested."""
    if req.session_id is None:
        return None
    sid = memory_store.ensure_session(req.session_id, mode=req.mode or "normal")
    if user_text:
        memory_store.add_message(sid, "user", user_text, emotion=emotion)
    if reply:
        memory_store.add_message(sid, "assistant", reply)
    return sid


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    history, memory_context, tone, detected = _prepare(req)
    last_user = next(
        (m["content"] for m in reversed(history) if m["role"] == "user"), ""
    )
    try:
        result = brain.respond(history, mode_key=req.mode, memory=memory_context, tone=tone)
    except Exception as exc:  # surface upstream/LLM errors cleanly
        raise HTTPException(status_code=502, detail=f"Brain error: {exc}") from exc

    sid = _persist(req, last_user, result["reply"], detected)
    return ChatResponse(**result, emotion=detected, session_id=sid)


@router.post("/chat/stream")
def chat_stream(req: ChatRequest) -> StreamingResponse:
    """Stream RIYA's reply as Server-Sent Events.

    Each event is a JSON object on a `data:` line:
      {"type": "meta",  "emotion": "...", "session_id": "..."}  — sent first
      {"type": "token", "text": "..."}                          — incremental text
      {"type": "done",  "mode": "...", "online": bool}
      {"type": "error", "detail": "..."}
    """
    history, memory_context, tone, detected = _prepare(req)
    mode = get_mode(req.mode)
    last_user = next(
        (m["content"] for m in reversed(history) if m["role"] == "user"), ""
    )

    def events() -> Iterator[str]:
        acc = ""
        try:
            sid = req.session_id
            yield f"data: {json.dumps({'type': 'meta', 'emotion': detected, 'session_id': sid})}\n\n"
            for chunk in brain.stream(history, mode_key=req.mode, memory=memory_context, tone=tone):
                acc += chunk
                yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
            sid = _persist(req, last_user, acc, detected)
            done = {"type": "done", "mode": mode.key, "online": brain.online, "session_id": sid}
            yield f"data: {json.dumps(done)}\n\n"
        except Exception as exc:
            err = {"type": "error", "detail": f"Brain error: {exc}"}
            yield f"data: {json.dumps(err)}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
