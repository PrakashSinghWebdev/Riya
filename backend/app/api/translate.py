"""Live translation API — uses the brain to translate text."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.brain import brain

router = APIRouter(prefix="/translate", tags=["translate"])


class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "English"
    source_lang: str | None = None  # None = auto-detect


@router.post("")
def translate(body: TranslateRequest) -> dict:
    text = (body.text or "").strip()
    if not text:
        return {"translation": "", "online": brain.online}
    if not brain.online:
        return {
            "translation": "(Brain offline — translation needs the AI model running.)",
            "online": False,
        }

    src = body.source_lang or "the detected language"
    prompt = (
        f"Translate the following text from {src} to {body.target_lang}. "
        "Reply with ONLY the translation, no preamble or quotes.\n\n"
        f"{text}"
    )
    try:
        out = brain.respond([{"role": "user", "content": prompt}], mode_key="normal")
    except Exception as exc:
        raise HTTPException(502, f"Translation error: {exc}") from exc
    return {"translation": out["reply"].strip(), "target_lang": body.target_lang, "online": True}
