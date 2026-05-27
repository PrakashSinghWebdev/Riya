import { useCallback, useRef, useState } from "react";
import {
  FilesetResolver,
  FaceLandmarker,
  GestureRecognizer,
  ObjectDetector,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

// Live webcam vision for RIYA, powered by Google MediaPipe (runs locally in the
// renderer; model files are fetched from the MediaPipe CDN the first time).
//   - FaceLandmarker blendshapes -> facial expression / mood
//   - GestureRecognizer          -> hand gestures
//
// Model + WASM assets (the "data from the internet"):
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const GESTURE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const OBJECT_MODEL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const DETECT_INTERVAL_MS = 120; // throttle face/hand (~8 fps) to spare the CPU
const HEAVY_INTERVAL_MS = 600; // object + pose are heavier — run them less often

// MediaPipe ships 7 canonical gestures; we recognize many more by reading the
// 21 hand landmarks it returns and analysing which fingers are extended.
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Classify a hand from its 21 landmarks (+ MediaPipe's built-in label as a hint).
function classifyHand(lm, builtin) {
  if (!lm || lm.length < 21) return null;

  // A finger is "up" when its tip sits above its middle (PIP) joint (y grows down).
  const up = {
    index: lm[8].y < lm[6].y,
    middle: lm[12].y < lm[10].y,
    ring: lm[16].y < lm[14].y,
    pinky: lm[20].y < lm[18].y,
  };
  // Thumb sticks out when its tip is farther from the pinky knuckle than its base.
  const thumb = dist(lm[4], lm[17]) > dist(lm[2], lm[17]) * 1.1;
  const count =
    (thumb ? 1 : 0) + up.index + up.middle + up.ring + up.pinky;

  // OK sign: thumb + index tips pinched, other fingers extended.
  if (dist(lm[4], lm[8]) < 0.06 && up.middle && up.ring && up.pinky)
    return "👌 OK";

  // Trust the model for orientation-sensitive / signed gestures.
  if (builtin === "Thumb_Up") return "👍 Thumbs up";
  if (builtin === "Thumb_Down") return "👎 Thumbs down";
  if (builtin === "ILoveYou") return "🤟 I love you";

  const key = `${thumb ? 1 : 0}${up.index ? 1 : 0}${up.middle ? 1 : 0}${
    up.ring ? 1 : 0
  }${up.pinky ? 1 : 0}`;
  const MAP = {
    "00000": "✊ Fist",
    "00100": "🖕 Middle finger",
    "11111": "🖐 Open palm",
    "01111": "🖖 Four",
    "01110": "three fingers",
    "01100": "✌️ Victory",
    "01000": "☝️ Pointing",
    "00001": "🤏 Pinky",
    "10000": "👍 Thumb",
    "10001": "🤙 Call me",
    "01001": "🤘 Rock on",
    "11001": "🤟 I love you",
    "11000": "🔫 Finger gun",
    "11100": "three (+thumb)",
  };
  if (MAP[key]) return MAP[key];
  return count > 0 ? `✋ ${count} finger${count > 1 ? "s" : ""}` : null;
}

// Coarse posture from the 33 pose landmarks (or null if no person).
function derivePose(lm) {
  if (!lm || lm.length < 29) return null;
  const wristY = Math.min(lm[15].y, lm[16].y); // higher hand (smaller y)
  const shoulderY = (lm[11].y + lm[12].y) / 2;
  if (wristY < shoulderY) return "🙌 Hands up";
  return "🧍 Person detected";
}

// Map a blendshape category list -> a coarse mood, matching RIYA's emotion set.
function deriveMood(categories) {
  const m = {};
  for (const c of categories) m[c.categoryName] = c.score;
  const avg = (a, b) => ((m[a] || 0) + (m[b] || 0)) / 2;

  const smile = avg("mouthSmileLeft", "mouthSmileRight");
  const frown = avg("mouthFrownLeft", "mouthFrownRight");
  const browDown = avg("browDownLeft", "browDownRight");
  const browInnerUp = m.browInnerUp || 0;
  const jawOpen = m.jawOpen || 0;
  const squint = avg("eyeSquintLeft", "eyeSquintRight");

  const scores = {
    happy: smile,
    sad: frown + browInnerUp * 0.4,
    angry: browDown,
    surprised: jawOpen * 0.6 + browInnerUp * 0.5,
    tired: squint * 0.8,
  };

  let best = "neutral";
  let bestScore = 0.25; // confidence floor; below this -> neutral
  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = mood;
      bestScore = score;
    }
  }
  return { mood: best, score: bestScore };
}

export function useVision() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false); // models loaded
  const [error, setError] = useState("");
  const [mood, setMood] = useState(null);
  const [moodScore, setMoodScore] = useState(0);
  const [gesture, setGesture] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [objects, setObjects] = useState([]); // detected object labels
  const [pose, setPose] = useState(null); // "standing/seated…" or null

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceRef = useRef(null);
  const gestureRef = useRef(null);
  const objectRef = useRef(null);
  const poseRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const heavyRef = useRef(0);
  const runningRef = useRef(false);

  const loadModels = useCallback(async () => {
    if (faceRef.current && gestureRef.current) return;
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const make = async (delegate) => {
      faceRef.current = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
      gestureRef.current = await GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: GESTURE_MODEL, delegate },
        runningMode: "VIDEO",
        numHands: 1,
      });
      objectRef.current = await ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: OBJECT_MODEL, delegate },
        runningMode: "VIDEO",
        scoreThreshold: 0.4,
        maxResults: 4,
      });
      poseRef.current = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    };
    try {
      await make("GPU");
    } catch {
      await make("CPU"); // some systems lack a usable GPU delegate
    }
    setReady(true);
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const v = videoRef.current;
    const now = performance.now();
    if (v && v.readyState >= 2 && now - lastRef.current >= DETECT_INTERVAL_MS) {
      lastRef.current = now;
      try {
        const f = faceRef.current?.detectForVideo(v, now);
        const cats = f?.faceBlendshapes?.[0]?.categories;
        if (cats?.length) {
          const { mood: mo, score } = deriveMood(cats);
          setFaceDetected(true);
          setMood(mo);
          setMoodScore(score);
        } else {
          setFaceDetected(false);
        }

        const g = gestureRef.current?.recognizeForVideo(v, now);
        const lm = g?.landmarks?.[0];
        const builtin = g?.gestures?.[0]?.[0]?.categoryName;
        setGesture(lm ? classifyHand(lm, builtin) : null);

        // Object detection + pose are heavier — run them less frequently.
        if (now - heavyRef.current >= HEAVY_INTERVAL_MS) {
          heavyRef.current = now;
          const od = objectRef.current?.detectForVideo(v, now);
          if (od?.detections) {
            const labels = [
              ...new Set(
                od.detections
                  .map((d) => d.categories?.[0]?.categoryName)
                  .filter(Boolean)
              ),
            ];
            setObjects(labels.slice(0, 4));
          }
          const pr = poseRef.current?.detectForVideo(v, now);
          setPose(derivePose(pr?.landmarks?.[0]));
        }
      } catch {
        /* transient frame error — keep looping */
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    setError("");
    try {
      await loadModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      runningRef.current = true;
      setEnabled(true);
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setError(
        e?.name === "NotAllowedError"
          ? "Camera access denied."
          : `Vision error: ${e?.message || e}`
      );
      setEnabled(false);
    }
  }, [loadModels, loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setEnabled(false);
    setMood(null);
    setGesture(null);
    setFaceDetected(false);
    setObjects([]);
    setPose(null);
  }, []);

  return {
    videoRef,
    enabled,
    ready,
    error,
    mood,
    moodScore,
    gesture,
    faceDetected,
    objects,
    pose,
    start,
    stop,
  };
}
