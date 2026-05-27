"""Automation Engine API (Phase 4 stub).

This subsystem executes real actions on the host (open apps, manage files, run
commands, control devices). Because that is high-risk, the contract is reserved
here but intentionally NOT implemented: execution must be gated behind explicit
user confirmation and a permission model before any action runs.
"""

from __future__ import annotations

from fastapi import APIRouter

from ._stub import planned

router = APIRouter(prefix="/automation", tags=["automation"])

CAPABILITIES = [
    "open applications",
    "file management",
    "run system commands",
    "web browsing / research",
    "device + IoT control",
    "task scheduling",
    "API integrations",
]


@router.get("/status")
def status() -> dict:
    return planned(
        "Automation Engine",
        4,
        CAPABILITIES,
        note="Execution is intentionally not wired up. It will require an explicit "
        "permission model and per-action user confirmation for safety.",
    )
