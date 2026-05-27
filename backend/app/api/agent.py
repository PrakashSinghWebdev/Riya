"""AI Agent API — autonomous planning (planning only, no execution)."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..core import agent as planner

router = APIRouter(prefix="/agent", tags=["agent"])


class PlanRequest(BaseModel):
    goal: str


@router.post("/plan")
def plan(body: PlanRequest) -> dict:
    """Break a goal into ordered steps. Does NOT execute them — execution is
    gated behind the Automation Engine (Phase 4) and explicit confirmation."""
    return planner.plan(body.goal)
