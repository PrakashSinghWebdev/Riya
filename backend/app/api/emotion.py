"""Emotion API — analyze text for the user's mood."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..core import emotion as engine

router = APIRouter(prefix="/emotion", tags=["emotion"])


class EmotionRequest(BaseModel):
    text: str


@router.post("/analyze")
def analyze(body: EmotionRequest) -> dict:
    return engine.detect(body.text).as_dict()
