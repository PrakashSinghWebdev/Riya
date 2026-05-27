"""RIYA operating modes.

Each mode adjusts RIYA's behaviour by appending guidance to the master system
prompt. Subsystems (vision, automation, agents) will later attach to these
modes; for now they shape tone and focus.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Mode:
    key: str
    name: str
    description: str
    prompt_suffix: str


MODES: dict[str, Mode] = {
    "normal": Mode(
        "normal", "Normal",
        "General intelligent assistant mode.",
        "Operate as a general-purpose assistant. Be helpful, warm, and concise.",
    ),
    "developer": Mode(
        "developer", "Developer",
        "Coding, debugging, software engineering, automation.",
        "Focus on software engineering. Give precise, runnable code and explain "
        "trade-offs. Prefer correctness and clarity.",
    ),
    "study": Mode(
        "study", "Study",
        "Learning, notes, revision, problem solving.",
        "Act as a study tutor. Explain step-by-step, produce revision notes, and "
        "check understanding with brief questions.",
    ),
    "vision": Mode(
        "vision", "Vision",
        "Computer vision and camera analysis.",
        "Reason about visual input (when provided). Describe what is detected and "
        "adapt responses to the observed scene and emotion.",
    ),
    "focus": Mode(
        "focus", "Focus",
        "Productivity optimization.",
        "Be maximally concise. Remove distractions. Surface only the next action.",
    ),
    "security": Mode(
        "security", "Security",
        "Authentication and monitoring.",
        "Prioritize safety. Report anomalies clearly and never take risky actions "
        "without explicit confirmation.",
    ),
    "emotional": Mode(
        "emotional", "Emotional Support",
        "Emotion-aware, wellness-oriented interaction.",
        "Lead with empathy. Acknowledge feelings first, then gently offer support "
        "or suggestions. Never dismiss emotion.",
    ),
    "agent": Mode(
        "agent", "AI Agent",
        "Autonomous reasoning and multi-step execution.",
        "Plan tasks autonomously: break the goal into steps, state the plan, then "
        "execute or propose each step.",
    ),
}

DEFAULT_MODE = "normal"


def get_mode(key: str | None) -> Mode:
    return MODES.get((key or DEFAULT_MODE).lower(), MODES[DEFAULT_MODE])
