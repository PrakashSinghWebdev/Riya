"""Security System API (Phase 3 stub).

Face / voice authentication and suspicious-activity monitoring. Depends on the
vision and voice subsystems plus a biometric enrollment store, all added later.
"""

from __future__ import annotations

from fastapi import APIRouter

from ._stub import planned

router = APIRouter(prefix="/security", tags=["security"])

CAPABILITIES = [
    "face authentication",
    "voice authentication",
    "suspicious-activity detection",
    "session locking",
    "intrusion alerts",
]


@router.get("/status")
def status() -> dict:
    return planned("Security System", 3, CAPABILITIES)
