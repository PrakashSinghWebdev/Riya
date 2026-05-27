"""Dev entrypoint: `python run.py` starts the RIYA backend with reload."""

from __future__ import annotations

import uvicorn

from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.riya_host,
        port=settings.riya_port,
        reload=settings.riya_reload,
        # Only watch source; the SQLite DB lives under backend/data/ and is
        # written on every persisted message — without this the reloader would
        # restart mid-request and could orphan the process.
        reload_dirs=["app"] if settings.riya_reload else None,
        reload_includes=["*.py"] if settings.riya_reload else None,
    )
