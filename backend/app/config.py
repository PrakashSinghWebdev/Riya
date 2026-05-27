"""Environment-driven settings for the RIYA backend.

Values are read from a `.env` file at the repo root (or real environment
variables). Nothing here is secret by itself — secrets live only in `.env`.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root is two levels up from this file: app/ -> backend/ -> Riya/
_REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # AI brain provider: "openai" (cloud) or "ollama" (local, no key needed).
    riya_provider: str = "openai"
    openai_api_key: str = ""
    riya_model: str = "gpt-4o-mini"
    # Override the API base URL. Blank = provider default (OpenAI's, or
    # Ollama's OpenAI-compatible endpoint at localhost:11434/v1).
    riya_base_url: str = ""

    # Server
    riya_host: str = "127.0.0.1"
    riya_port: int = 8000

    # Data directory (SQLite db, future vector stores). Defaults to backend/data.
    riya_data_dir: str = str(_REPO_ROOT / "backend" / "data")

    @property
    def data_path(self) -> Path:
        p = Path(self.riya_data_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def db_path(self) -> Path:
        return self.data_path / "riya.db"

    # CORS — comma-separated list in the env var, parsed to a list here.
    riya_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.riya_cors_origins.split(",") if o.strip()]

    @property
    def provider(self) -> str:
        return self.riya_provider.strip().lower()

    @property
    def is_ollama(self) -> bool:
        return self.provider == "ollama"

    @property
    def base_url(self) -> str | None:
        if self.riya_base_url.strip():
            return self.riya_base_url.strip()
        if self.is_ollama:
            return "http://localhost:11434/v1"
        return None  # OpenAI SDK default

    @property
    def api_key(self) -> str:
        # Ollama ignores the key but the OpenAI SDK requires a non-empty value.
        return self.openai_api_key.strip() or ("ollama" if self.is_ollama else "")

    @property
    def has_brain(self) -> bool:
        # Local provider needs no key; cloud needs one.
        return self.is_ollama or bool(self.openai_api_key.strip())

    # Back-compat alias used by older call sites.
    @property
    def has_openai(self) -> bool:
        return self.has_brain


settings = Settings()
