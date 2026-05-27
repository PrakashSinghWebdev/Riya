"""Voice API (server-side STT/TTS stub).

Real-time voice currently runs client-side via the Web Speech API in the HUD.
Server-side, high-quality voice (Whisper transcription, ElevenLabs / Azure
neural TTS) plugs in here behind the same contract.
"""

from __future__ import annotations

from fastapi import APIRouter

from ._stub import planned

router = APIRouter(prefix="/voice", tags=["voice"])

CAPABILITIES = [
    "wake-word detection",
    "speech-to-text (Whisper)",
    "neural text-to-speech (ElevenLabs / Azure)",
    "emotional voice modulation",
    "multilingual support",
]


@router.get("/status")
def status() -> dict:
    return planned(
        "Voice Intelligence",
        1,
        CAPABILITIES,
        note="Live STT/TTS runs client-side (Web Speech API) in the HUD today. "
        "Server-side Whisper + neural TTS will be exposed here.",
    )


@router.post("/transcribe")
def transcribe() -> dict:
    return planned("Voice Intelligence (STT)", 1, ["speech-to-text (Whisper)"])


@router.post("/speak")
def speak() -> dict:
    return planned("Voice Intelligence (TTS)", 1, ["neural text-to-speech"])
