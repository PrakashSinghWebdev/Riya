"""Health + capability reporting."""

from __future__ import annotations

from fastapi import APIRouter

from .. import __version__
from ..config import settings
from ..core.brain import brain
from ..core.modes import MODES

router = APIRouter(tags=["system"])

# High-level subsystem map (PRD's nine core systems) with implementation state.
SUBSYSTEMS = [
    {"key": "voice", "name": "Voice Intelligence", "phase": 1, "implemented": True,
     "note": "client-side STT/TTS live; server-side Whisper/TTS reserved"},
    {"key": "brain", "name": "AI Brain", "phase": 1, "implemented": True},
    {"key": "emotion", "name": "Emotion Engine", "phase": 3, "implemented": True,
     "note": "text lexicon live; visual emotion is Phase 3"},
    {"key": "memory", "name": "Memory System", "phase": 2, "implemented": True},
    {"key": "agent", "name": "AI Agent System", "phase": 4, "implemented": True,
     "note": "planning only; execution gated"},
    {"key": "vision", "name": "Vision Intelligence", "phase": 3, "implemented": True,
     "note": "camera face-mood + hand gestures live"},
    {"key": "automation", "name": "Automation Engine", "phase": 4, "implemented": True,
     "note": "gated: open apps/URLs/paths with confirmation"},
    {"key": "research", "name": "Internet Research", "phase": 4, "implemented": True},
    {"key": "security", "name": "Security System", "phase": 3, "implemented": False},
    {"key": "decision", "name": "Decision Engine", "phase": 5, "implemented": False},
]


@router.get("/health")
def health() -> dict:
    """Liveness + which subsystems are currently online."""
    return {
        "status": "ok",
        "version": __version__,
        "brain_online": brain.online,
        "provider": settings.provider,
        "model": settings.riya_model if brain.online else None,
        "modes": [
            {"key": m.key, "name": m.name, "description": m.description}
            for m in MODES.values()
        ],
        "subsystems": SUBSYSTEMS,
    }
