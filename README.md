# RIYA — Neo-Holographic AI Ecosystem

> A next-generation AI assistant inspired by JARVIS: voice, vision, automation,
> emotional intelligence, memory, and autonomous agents — wrapped in a
> futuristic "NEXUS" holographic HUD.

This repository is the **Phase-1 scaffold**: a runnable foundation you can build
the full PRD on top of. It is intentionally a thin vertical slice — a real
OpenAI-backed brain, a FastAPI backend, and an Electron + React HUD — not the
complete ecosystem. Heavy subsystems (vision, voice, agents) plug in later
behind the interfaces stubbed here.

## Architecture

```
┌─────────────────────────────┐        HTTP / JSON        ┌──────────────────────────┐
│  Frontend (Electron + React)│  ───────────────────────► │  Backend (FastAPI)        │
│  NEXUS holographic HUD       │  ◄─────────────────────── │  /api/chat  /api/health   │
│  Tailwind + Framer Motion    │                            │  RIYA brain → OpenAI      │
└─────────────────────────────┘                            └──────────────────────────┘
```

- **backend/** — Python FastAPI service. `app/core/brain.py` wraps OpenAI and is
  primed with the RIYA master system prompt. Modes, memory, vision, and agents
  are stubbed as extension points.
- **frontend/** — Electron desktop shell loading a Vite + React app that renders
  the NEXUS HUD (camera / avatar / system panels, voice waveform, mode bar).

## Prerequisites

- Python 3.11+ and Node 18+
- An OpenAI API key (optional for the UI; required for real responses)

## Setup

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1     # Windows PowerShell
pip install -r requirements.txt
copy ..\.env.example ..\.env     # then edit .env and add OPENAI_API_KEY
python run.py
```

The API serves at `http://127.0.0.1:8000` (docs at `/docs`). Without an API key
the brain returns a clearly-labelled offline stub so the UI still works.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev        # browser UI at http://localhost:5173
npm run electron   # launches the Electron desktop HUD
```

## Project layout

```
Riya/
├── backend/
│   ├── run.py                     # uvicorn entrypoint
│   ├── requirements.txt
│   └── app/
│       ├── main.py                # FastAPI app + CORS + routers
│       ├── config.py              # env-driven settings
│       ├── core/
│       │   ├── system_prompt.py   # RIYA master system prompt
│       │   ├── brain.py           # OpenAI client wrapper (+ offline stub)
│       │   └── modes.py           # mode registry (Normal/Developer/...)
│       └── api/
│           ├── chat.py            # POST /api/chat
│           └── health.py          # GET  /api/health
└── frontend/
    ├── electron/                  # main + preload (desktop shell)
    └── src/
        ├── App.jsx                # HUD composition
        ├── api/client.js          # talks to the backend
        └── components/            # HUD frame, panels, waveform, mode bar
```

## Roadmap (from the PRD)

1. ✅ Voice-assistant foundation + LLM integration *(this scaffold covers the LLM brain + HUD)*
2. Desktop automation & memory systems
3. Vision AI & emotion analysis
4. Autonomous AI agents & workflows
5. Human-like reasoning & predictive intelligence
6. Avatar ecosystem & smart-environment integration
7. Fully autonomous AI operating ecosystem

See `app/core/modes.py` and the panel stubs for where each subsystem hooks in.
