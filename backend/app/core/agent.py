"""AI Agent planner.

Turns a high-level goal into an ordered, reviewable plan of steps using the
brain. This module deliberately PLANS ONLY — it does not execute anything.
Execution belongs to the Automation Engine (Phase 4) and must remain gated
behind explicit user confirmation for safety.
"""

from __future__ import annotations

import re

from .brain import brain

_PLANNER_PROMPT = (
    "You are RIYA's planning module. Break the user's goal into a short, ordered "
    "list of concrete, actionable steps. Reply with ONLY a numbered list (one "
    "step per line, no preamble, no commentary). Keep it to at most 8 steps."
)

_NUM_RE = re.compile(r"^\s*(?:\d+[.)]|[-*])\s*(.+)$")


def _parse_steps(text: str) -> list[str]:
    steps: list[str] = []
    for line in text.splitlines():
        m = _NUM_RE.match(line)
        if m:
            steps.append(m.group(1).strip())
        elif line.strip():
            steps.append(line.strip())
    return [s for s in steps if s]


def plan(goal: str) -> dict:
    """Return {goal, steps, online}. Falls back to a stub plan when offline."""
    goal = (goal or "").strip()
    if not goal:
        return {"goal": goal, "steps": [], "online": brain.online}

    if not brain.online:
        return {
            "goal": goal,
            "steps": [
                "Clarify the desired outcome and constraints.",
                f"Gather information needed for: {goal}.",
                "Draft an approach and identify required tools.",
                "Execute the approach step by step.",
                "Verify the result and report back.",
            ],
            "online": False,
            "note": "Offline stub plan — set OPENAI_API_KEY for a tailored plan.",
        }

    history = [
        {"role": "user", "content": f"{_PLANNER_PROMPT}\n\nGoal: {goal}"},
    ]
    result = brain.respond(history, mode_key="agent")
    return {"goal": goal, "steps": _parse_steps(result["reply"]), "online": True}
