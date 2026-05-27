"""Automation Engine API — gated execution (open apps / URLs / paths).

Two-step by design for safety: `propose` interprets a request and returns a
structured action without running anything; `execute` runs it only after the
user confirms in the UI. Only whitelisted action types are permitted.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..core import automation as engine
from ._stub import planned

router = APIRouter(prefix="/automation", tags=["automation"])

CAPABILITIES = [
    "open allowed applications",
    "open a website / file / folder",
    "type text + press keys (virtual keyboard)",
    "move + click the cursor",
    "switch / close windows",
    "delete files (with confirmation)",
]


class ProposeRequest(BaseModel):
    request: str


class ExecuteRequest(BaseModel):
    action: str
    target: str = ""
    confirm: bool = False


@router.get("/status")
def status() -> dict:
    info = planned("Automation Engine", 4, CAPABILITIES)
    info.update(
        {
            "implemented": True,
            "status": "active",
            "actions": sorted(engine.ACTIONS),
            "destructive": sorted(engine.DESTRUCTIVE),
            "allowed_apps": sorted(engine.APPS),
            "gui": engine._GUI,
            "note": "Routine actions run instantly; destructive ones need confirm.",
        }
    )
    return info


@router.post("/propose")
def propose(body: ProposeRequest) -> dict:
    """Interpret a request into a structured action — does NOT execute."""
    return engine.propose(body.request)


@router.post("/execute")
def execute(body: ExecuteRequest) -> dict:
    """Run an action. Destructive actions return needs_confirmation unless confirm=True."""
    return engine.execute(body.action, body.target, confirm=body.confirm)
