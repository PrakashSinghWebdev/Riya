"""FastAPI application factory for RIYA."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import (
    agent,
    automation,
    chat,
    emotion,
    health,
    memory,
    reminders,
    research,
    security,
    settings as settings_api,
    translate,
    vision,
    voice,
)
from .config import settings
from .db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # ensure the SQLite schema exists before serving
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="RIYA AI Ecosystem",
        description="Backend brain for the RIYA neo-holographic AI assistant.",
        version=__version__,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Implemented subsystems
    app.include_router(health.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(memory.router, prefix="/api")
    app.include_router(emotion.router, prefix="/api")
    app.include_router(agent.router, prefix="/api")
    app.include_router(settings_api.router, prefix="/api")
    app.include_router(research.router, prefix="/api")
    app.include_router(reminders.router, prefix="/api")
    app.include_router(translate.router, prefix="/api")
    app.include_router(automation.router, prefix="/api")
    # Reserved-contract subsystems (later phases)
    app.include_router(vision.router, prefix="/api")
    app.include_router(voice.router, prefix="/api")
    app.include_router(security.router, prefix="/api")

    @app.get("/")
    def root() -> dict:
        return {"name": "RIYA", "version": __version__, "docs": "/docs"}

    return app


app = create_app()
