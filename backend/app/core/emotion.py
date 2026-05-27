"""Lightweight text-based emotion engine.

A fast lexicon classifier — no ML dependencies. It maps cue words to the PRD's
emotion set and returns the dominant mood plus a tone instruction the brain
uses to adapt its voice. Camera/voice emotion (DeepFace, prosody) is Phase 3
and can replace this behind `detect()`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Emotion -> cue words. Kept small and high-signal; extend freely.
_LEXICON: dict[str, set[str]] = {
    "happy": {"happy", "great", "awesome", "glad", "love", "wonderful", "yay", "good", "thanks", "nice", ":)", "😊", "😀"},
    "sad": {"sad", "down", "unhappy", "depressed", "cry", "lonely", "hurt", "miss", "sorry", ":(", "😢", "😞"},
    "angry": {"angry", "mad", "furious", "hate", "annoyed", "frustrated", "stupid", "wtf", "ugh", "😠", "😡"},
    "stressed": {"stressed", "anxious", "overwhelmed", "pressure", "deadline", "worried", "panic", "tense", "nervous"},
    "excited": {"excited", "can't wait", "amazing", "thrilled", "pumped", "incredible", "wow", "!!", "🔥", "🎉"},
    "tired": {"tired", "exhausted", "sleepy", "drained", "burnt", "burnout", "fatigued", "no energy", "yawn", "😴"},
}

# Tone guidance per emotion (mirrors the PRD's emotional-intelligence rules).
_TONE: dict[str, str] = {
    "happy": "Match their positive energy; be warm and affirming.",
    "sad": "Be gentle and supportive. Acknowledge their feelings first.",
    "angry": "Stay calm and non-defensive. Validate frustration, then help.",
    "stressed": "Use a calm, reassuring tone. Reduce load; surface one next step.",
    "excited": "Be energetic and enthusiastic. Share their momentum.",
    "tired": "Be concise and considerate. Offer to simplify or defer work.",
    "neutral": "Maintain a calm, intelligent, helpful tone.",
}

_WORD_RE = re.compile(r"[a-z0-9']+|[:;][)(]|[\U0001F300-\U0001FAFF]")


@dataclass
class EmotionResult:
    emotion: str
    confidence: float            # 0..1
    scores: dict[str, int]       # raw cue counts per emotion
    tone: str                    # instruction for the brain

    def as_dict(self) -> dict:
        return {
            "emotion": self.emotion,
            "confidence": round(self.confidence, 3),
            "scores": self.scores,
            "tone": self.tone,
        }


def detect(text: str) -> EmotionResult:
    lowered = (text or "").lower()
    tokens = set(_WORD_RE.findall(lowered))

    scores: dict[str, int] = {}
    for emotion, cues in _LEXICON.items():
        hits = sum(1 for c in cues if (c in tokens or (" " in c and c in lowered)))
        if hits:
            scores[emotion] = hits

    if not scores:
        return EmotionResult("neutral", 0.0, {}, _TONE["neutral"])

    top = max(scores, key=scores.get)
    total = sum(scores.values())
    confidence = scores[top] / total
    return EmotionResult(top, confidence, scores, _TONE.get(top, _TONE["neutral"]))
