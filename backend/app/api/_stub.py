"""Helpers for subsystems that are defined in the API contract but not yet
implemented (they require heavy native deps or hardware access added in later
phases). These endpoints are honest: they describe the planned capability and
return HTTP 200 with a clear `status: "planned"` rather than faking data.
"""

from __future__ import annotations


def planned(subsystem: str, phase: int, capabilities: list[str], note: str = "") -> dict:
    return {
        "subsystem": subsystem,
        "phase": phase,
        "status": "planned",
        "implemented": False,
        "capabilities": capabilities,
        "note": note
        or f"{subsystem} is part of the RIYA roadmap (Phase {phase}); the API "
        "contract is reserved here and returns no fabricated data.",
    }
