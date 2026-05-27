"""The RIYA brain: a thin wrapper over OpenAI's chat completions.

If no API key is configured the brain returns a clearly-labelled offline stub,
so the UI and the rest of the stack remain runnable without credentials.
"""

from __future__ import annotations

from collections.abc import Iterator

from ..config import settings
from .modes import get_mode
from .system_prompt import RIYA_SYSTEM_PROMPT

# Import lazily so the package still imports if `openai` isn't installed yet.
try:
    from openai import OpenAI

    _OPENAI_AVAILABLE = True
except Exception:  # pragma: no cover - import-time guard
    OpenAI = None  # type: ignore[assignment]
    _OPENAI_AVAILABLE = False


class Brain:
    """Stateless reasoning core. Conversation history is passed in per call."""

    def __init__(self) -> None:
        self._client = None
        if _OPENAI_AVAILABLE and settings.has_brain:
            # The OpenAI SDK also drives Ollama's OpenAI-compatible endpoint;
            # only the base_url + key differ between providers.
            self._client = OpenAI(
                api_key=settings.api_key,
                base_url=settings.base_url,
            )

    @property
    def online(self) -> bool:
        return self._client is not None

    def _build_messages(
        self,
        history: list[dict[str, str]],
        mode_key: str | None,
        memory: str = "",
        tone: str = "",
    ) -> list[dict[str, str]]:
        mode = get_mode(mode_key)
        parts = [RIYA_SYSTEM_PROMPT, f"ACTIVE MODE: {mode.name}\n{mode.prompt_suffix}"]
        if memory:
            parts.append(memory)
        if tone:
            parts.append(f"The user's current emotional tone: {tone}")
        return [{"role": "system", "content": "\n\n".join(parts)}, *history]

    def respond(
        self,
        history: list[dict[str, str]],
        mode_key: str | None = None,
        memory: str = "",
        tone: str = "",
    ) -> dict[str, str]:
        """Return RIYA's reply to a conversation `history`.

        `history` is a list of {role, content} dicts (user/assistant turns).
        Returns {"reply": str, "mode": str, "online": bool}.
        """
        mode = get_mode(mode_key)

        if not self.online:
            user_last = next(
                (m["content"] for m in reversed(history) if m["role"] == "user"),
                "",
            )
            return {
                "reply": (
                    "[OFFLINE STUB] RIYA brain is running without an OpenAI key. "
                    f"Set OPENAI_API_KEY in .env to go online. You said: "
                    f"“{user_last}”"
                ),
                "mode": mode.key,
                "online": False,
            }

        messages = self._build_messages(history, mode_key, memory, tone)
        completion = self._client.chat.completions.create(  # type: ignore[union-attr]
            model=settings.riya_model,
            messages=messages,
            temperature=0.7,
        )
        return {
            "reply": completion.choices[0].message.content or "",
            "mode": mode.key,
            "online": True,
        }

    def stream(
        self,
        history: list[dict[str, str]],
        mode_key: str | None = None,
        memory: str = "",
        tone: str = "",
    ) -> Iterator[str]:
        """Yield RIYA's reply as text chunks for incremental rendering."""
        if not self.online:
            user_last = next(
                (m["content"] for m in reversed(history) if m["role"] == "user"),
                "",
            )
            stub = (
                "[OFFLINE STUB] RIYA brain is running without an OpenAI key. "
                f"Set OPENAI_API_KEY in .env to go online. You said: “{user_last}”"
            )
            # Emit word-by-word so the UI still shows a live "typing" effect.
            for word in stub.split(" "):
                yield word + " "
            return

        messages = self._build_messages(history, mode_key, memory, tone)
        stream = self._client.chat.completions.create(  # type: ignore[union-attr]
            model=settings.riya_model,
            messages=messages,
            temperature=0.7,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


# Module-level singleton used by the API layer.
brain = Brain()
