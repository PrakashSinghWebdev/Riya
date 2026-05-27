"""Internet research API."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..core import research as engine

router = APIRouter(prefix="/research", tags=["research"])


class ResearchRequest(BaseModel):
    query: str
    max_results: int = 5


@router.post("")
def do_research(body: ResearchRequest) -> dict:
    return engine.research(body.query, body.max_results)
