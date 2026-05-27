"""Vision API (Phase 3 stub).

Real implementation will use OpenCV / MediaPipe / YOLOv8 / DeepFace for face,
pose, gesture, object detection, OCR, and visual emotion. Those are heavy
native deps deliberately kept out of this layer for now.
"""

from __future__ import annotations

from fastapi import APIRouter

from ._stub import planned

router = APIRouter(prefix="/vision", tags=["vision"])

CAPABILITIES = [
    "face detection",
    "eye / gaze tracking",
    "motion detection",
    "hand + pose tracking",
    "gesture controls",
    "object detection",
    "screen OCR",
    "visual emotion recognition",
    "scene / environment understanding",
]


@router.get("/status")
def status() -> dict:
    return planned("Vision Intelligence", 3, CAPABILITIES)


@router.post("/analyze")
def analyze() -> dict:
    return planned(
        "Vision Intelligence",
        3,
        CAPABILITIES,
        note="Frame analysis not yet implemented. Will accept an image/frame and "
        "return detections (faces, objects, pose, OCR text, scene emotion).",
    )
