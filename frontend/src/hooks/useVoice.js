import { useCallback, useEffect, useRef, useState } from "react";

// Browser/Electron voice via the Web Speech API:
//   - SpeechRecognition  -> speech-to-text (mic input)
//   - speechSynthesis    -> text-to-speech (RIYA speaks)
// No native deps. Whisper / ElevenLabs can replace these later behind the
// same start/stop/speak interface.

const SpeechRecognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export function useVoice({ onFinalTranscript } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  const supported = {
    stt: Boolean(SpeechRecognition),
    tts: typeof window !== "undefined" && "speechSynthesis" in window,
  };

  useEffect(() => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      setInterim(interimText);
      if (finalText) {
        setInterim("");
        onFinalRef.current?.(finalText.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recognitionRef.current = rec;
    return () => rec.abort();
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, [listening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const speak = useCallback(
    (text) => {
      if (!supported.tts || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      // Prefer a calm female voice to match RIYA's persona, when available.
      const voices = window.speechSynthesis.getVoices();
      u.voice =
        voices.find((v) => /female|zira|samantha|google us english/i.test(v.name)) ||
        voices[0] ||
        null;
      u.rate = 1;
      u.pitch = 1.05;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [supported.tts]
  );

  const stopSpeaking = useCallback(() => {
    if (supported.tts) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported.tts]);

  return {
    supported,
    listening,
    speaking,
    interim,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
