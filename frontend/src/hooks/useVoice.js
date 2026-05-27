import { useCallback, useEffect, useRef, useState } from "react";

// Hands-free voice for RIYA via the Web Speech API.
//
// Wake-word flow (no mic button needed):
//   "off"      -> not listening
//   "sleeping" -> always listening, waiting for a wake phrase
//   "active"   -> wake phrase heard; the next thing you say is sent to RIYA
//
// After a command is captured we drop back to "sleeping". Recognition is
// continuous and auto-restarts on end, so it stays armed. While RIYA is
// speaking we ignore input to avoid her own voice re-triggering her.

const SpeechRecognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

// Phrases that wake RIYA. Order doesn't matter; matched as substrings.
const WAKE_PHRASES = [
  "hey riya",
  "hello riya",
  "hi riya",
  "wake up baby",
  "wake up riya",
  "wake up",
  "hey baby",
  "riya",
];

function findWake(lower) {
  for (const p of WAKE_PHRASES) {
    const i = lower.indexOf(p);
    if (i !== -1) return i + p.length; // index just past the wake phrase
  }
  return -1;
}

export function useVoice({ onCommand } = {}) {
  const [state, setState] = useState("off"); // off | sleeping | active
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");

  const recRef = useRef(null);
  const stateRef = useRef("off");
  const speakingRef = useRef(false);
  const wantOnRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const supported = {
    stt: Boolean(SpeechRecognition),
    tts: typeof window !== "undefined" && "speechSynthesis" in window,
  };

  const setBoth = (s) => {
    stateRef.current = s;
    setState(s);
  };

  const submitCommand = useCallback((text) => {
    const t = (text || "").trim();
    if (!t) return; // nothing said yet — stay active and keep waiting
    setBoth("sleeping");
    setInterim("");
    onCommandRef.current?.(t);
  }, []);

  useEffect(() => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      if (speakingRef.current) return; // don't react to RIYA's own voice

      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += tr;
        else interimText += tr;
      }
      setInterim(interimText);

      const cur = stateRef.current;
      if (cur === "sleeping") {
        const probe = (finalText || interimText).toLowerCase();
        const end = findWake(probe);
        if (end !== -1) {
          setBoth("active");
          // If the command rode in on the same utterance, send the remainder.
          if (finalText) {
            const remainder = finalText.slice(end).trim();
            if (remainder) submitCommand(remainder);
          }
        }
      } else if (cur === "active") {
        if (finalText) submitCommand(finalText);
      }
    };

    rec.onend = () => {
      if (wantOnRef.current) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      } else {
        setBoth("off");
      }
    };
    rec.onerror = () => {
      // "no-speech"/"aborted" are normal; onend handles the restart.
    };

    recRef.current = rec;
    return () => {
      wantOnRef.current = false;
      rec.abort();
    };
  }, [submitCommand]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    wantOnRef.current = true;
    setBoth("sleeping");
    try {
      recRef.current.start();
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    wantOnRef.current = false;
    setBoth("off");
    setInterim("");
    try {
      recRef.current?.stop();
    } catch {
      /* not running */
    }
  }, []);

  const speak = useCallback(
    (text) => {
      if (!supported.tts || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      u.voice =
        voices.find((v) => /female|zira|samantha|google us english/i.test(v.name)) ||
        voices[0] ||
        null;
      u.rate = 1;
      u.pitch = 1.05;
      u.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
      };
      u.onend = () => {
        speakingRef.current = false;
        setSpeaking(false);
      };
      window.speechSynthesis.speak(u);
    },
    [supported.tts]
  );

  const stopSpeaking = useCallback(() => {
    if (supported.tts) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  }, [supported.tts]);

  return {
    supported,
    state, // "off" | "sleeping" | "active"
    listening: state === "active",
    awake: state !== "off",
    speaking,
    interim,
    start,
    stop,
    speak,
    stopSpeaking,
  };
}
