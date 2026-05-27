import { useCallback, useEffect, useRef, useState } from "react";
import {
  getHealth,
  streamChat,
  createSession,
  getSessionMessages,
  getEmotions,
  getSettings,
  putSetting,
} from "./api/client";
import { useVoice } from "./hooks/useVoice";
import { useVision } from "./hooks/useVision";
import ParticleField from "./components/ParticleField";
import Panel from "./components/Panel";
import Waveform from "./components/Waveform";
import ModeBar from "./components/ModeBar";
import Avatar from "./components/Avatar";
import Conversation from "./components/Conversation";
import Drawer from "./components/Drawer";
import MemoryPanel from "./components/MemoryPanel";
import AgentPanel from "./components/AgentPanel";
import EmotionPanel from "./components/EmotionPanel";
import ToolsPanel from "./components/ToolsPanel";
import { dueReminders } from "./api/client";

const SESSION_KEY = "riya.sessionId";
const MOOD_EMOJI = {
  happy: "😊",
  sad: "😔",
  angry: "😠",
  surprised: "😮",
  tired: "😴",
  neutral: "🙂",
};

export default function App() {
  const [health, setHealth] = useState(null);
  const [modes, setModes] = useState([]);
  const [mode, setMode] = useState("normal");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [emotion, setEmotion] = useState(null);
  const [emotionSummary, setEmotionSummary] = useState(null);
  const [drawer, setDrawer] = useState(null); // "memory" | "agent" | null
  const inputRef = useRef(null);

  const voice = useVoice({ onCommand: (text) => sendMessage(text) });
  const vision = useVision();

  const refreshEmotions = useCallback((sid) => {
    if (!sid) return;
    getEmotions(sid)
      .then((d) => setEmotionSummary(d.summary))
      .catch(() => {});
  }, []);

  // Boot: health, persisted settings, and resume/create a session.
  useEffect(() => {
    getHealth()
      .then((h) => {
        setHealth(h);
        setModes(h.modes || []);
      })
      .catch(() => setError("Backend offline — start it with `python run.py`."));

    getSettings()
      .then((s) => {
        if (s.mode) setMode(s.mode);
        if (s.voice) setAutoSpeak(s.voice === "on");
      })
      .catch(() => {});

    (async () => {
      const saved = localStorage.getItem(SESSION_KEY);
      try {
        if (saved) {
          const msgs = await getSessionMessages(saved);
          setSessionId(saved);
          setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
          refreshEmotions(saved);
        } else {
          const s = await createSession({ mode: "normal" });
          setSessionId(s.id);
          localStorage.setItem(SESSION_KEY, s.id);
        }
      } catch {
        // Saved session may have been deleted; start a fresh one.
        const s = await createSession({ mode: "normal" }).catch(() => null);
        if (s) {
          setSessionId(s.id);
          localStorage.setItem(SESSION_KEY, s.id);
        }
      }
    })();
  }, [refreshEmotions]);

  // Persist preference changes to the backend.
  useEffect(() => {
    if (health) putSetting("mode", mode).catch(() => {});
  }, [mode, health]);
  useEffect(() => {
    if (health) putSetting("voice", autoSpeak ? "on" : "off").catch(() => {});
  }, [autoSpeak, health]);

  // Arm hands-free wake-word listening once, as soon as it's supported.
  useEffect(() => {
    if (voice.supported.stt) voice.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.supported.stt]);

  // Easter egg: flip RIYA off and she fires back. Fires once per show (4s cooldown).
  const middleFingerAt = useRef(0);
  useEffect(() => {
    if (!vision.gesture?.includes("Middle finger")) return;
    const now = Date.now();
    if (now - middleFingerAt.current < 4000) return;
    middleFingerAt.current = now;
    const clapback = "Fuck you, bitch!";
    voice.speak(clapback);
    setMessages((m) => [...m, { role: "assistant", content: clapback }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vision.gesture]);

  // Poll for due reminders and alert (desktop notification + voice + message).
  useEffect(() => {
    if (!health) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const tick = async () => {
      try {
        const due = await dueReminders();
        for (const r of due) {
          const line = `Reminder: ${r.text}`;
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("RIYA", { body: r.text });
          }
          voice.speak(line);
          setMessages((m) => [...m, { role: "assistant", content: `⏰ ${line}` }]);
        }
      } catch {
        /* backend may be down briefly */
      }
    };
    const id = setInterval(tick, 30000);
    tick();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health]);

  async function newSession() {
    const s = await createSession({ mode });
    setSessionId(s.id);
    localStorage.setItem(SESSION_KEY, s.id);
    setMessages([]);
    setEmotion(null);
    setEmotionSummary(null);
    setDrawer(null);
  }

  async function resumeSession(id) {
    const msgs = await getSessionMessages(id);
    setSessionId(id);
    localStorage.setItem(SESSION_KEY, id);
    setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
    refreshEmotions(id);
    setDrawer(null);
  }

  async function sendMessage(text) {
    const trimmed = (text ?? "").trim();
    if (!trimmed || thinking) return;

    const history = [...messages, { role: "user", content: trimmed }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setThinking(true);
    setError("");
    voice.stopSpeaking();

    let acc = "";
    try {
      await streamChat(
        { messages: history, mode, session_id: sessionId },
        {
          onMeta: (m) => {
            if (m.emotion) setEmotion(m.emotion);
            if (m.session_id && m.session_id !== sessionId) {
              setSessionId(m.session_id);
              localStorage.setItem(SESSION_KEY, m.session_id);
            }
          },
          onToken: (t) => {
            acc += t;
            setMessages((prev) => {
              const copy = prev.slice();
              copy[copy.length - 1] = { role: "assistant", content: acc };
              return copy;
            });
          },
          onDone: (d) => {
            if (autoSpeak) voice.speak(acc);
            refreshEmotions(d.session_id || sessionId);
          },
        }
      );
    } catch (err) {
      setError(String(err.message || err));
      setMessages((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1)));
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  const brainOnline = health?.brain_online;
  const active = thinking || voice.speaking || voice.listening;
  const subsystems = health?.subsystems || [];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <ParticleField />

      {/* ── Title bar ───────────────────────────────────────────── */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-nexus-blue/20 px-4 py-1.5">
        <h1 className="font-head text-lg tracking-[0.4em] text-nexus-cyan drop-shadow-[0_0_10px_rgba(34,224,224,0.6)]">
          R I Y A
        </h1>
        <div className="flex items-center gap-3 font-head text-[11px] uppercase tracking-widest">
          <button
            onClick={() => setDrawer("memory")}
            className="rounded-md border border-nexus-blue/30 px-3 py-1 text-nexus-blue/70 hover:border-nexus-cyan hover:text-nexus-cyan"
          >
            🧠 Memory
          </button>
          <button
            onClick={() => setDrawer("agent")}
            className="rounded-md border border-nexus-blue/30 px-3 py-1 text-nexus-blue/70 hover:border-nexus-cyan hover:text-nexus-cyan"
          >
            🤖 Agent
          </button>
          <button
            onClick={() => setDrawer("tools")}
            className="rounded-md border border-nexus-blue/30 px-3 py-1 text-nexus-blue/70 hover:border-nexus-cyan hover:text-nexus-cyan"
          >
            🛠 Tools
          </button>
          <span className={brainOnline ? "text-nexus-success" : "text-nexus-danger"}>
            ● Brain {brainOnline ? "Online" : health ? "Offline-stub" : "—"}
          </span>
          {health?.model && <span className="text-nexus-blue/70">{health.model}</span>}
        </div>
      </header>

      {/* ── HUD grid ────────────────────────────────────────────── */}
      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-2.5 p-2.5">
        <Panel
          title="Vision — Face & Gesture"
          status={vision.enabled ? (vision.faceDetected ? "face ✓" : "scanning") : "off"}
        >
          <div className="relative h-full w-full overflow-hidden rounded-lg border border-nexus-blue/30 bg-black/50">
            <video
              ref={vision.videoRef}
              muted
              playsInline
              style={{ transform: "scaleX(-1)" }}
              className={`h-full w-full object-cover transition-opacity ${
                vision.enabled ? "opacity-100" : "opacity-0"
              }`}
            />

            {!vision.enabled ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-nexus-blue/60">
                <span>📷 Webcam off</span>
                <button
                  onClick={vision.start}
                  className="rounded-md border border-nexus-cyan bg-nexus-cyan/15 px-3 py-1 font-head text-[11px] uppercase tracking-widest text-nexus-cyan hover:bg-nexus-cyan/25"
                >
                  Enable camera
                </button>
                {vision.error && (
                  <span className="px-2 text-center text-nexus-danger">{vision.error}</span>
                )}
              </div>
            ) : (
              <>
                <div className="absolute left-2 top-2 flex flex-col gap-1">
                  <span className="rounded bg-black/60 px-2 py-0.5 font-head text-[11px] uppercase tracking-wider text-nexus-cyan backdrop-blur">
                    {MOOD_EMOJI[vision.mood] || "🙂"} {vision.mood || "…"}
                  </span>
                  {vision.gesture && (
                    <span className="rounded bg-black/60 px-2 py-0.5 text-[11px] text-nexus-purple backdrop-blur">
                      {vision.gesture}
                    </span>
                  )}
                  {vision.pose && (
                    <span className="rounded bg-black/60 px-2 py-0.5 text-[11px] text-nexus-blue/80 backdrop-blur">
                      {vision.pose}
                    </span>
                  )}
                </div>
                {vision.objects?.length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                    {vision.objects.map((o) => (
                      <span
                        key={o}
                        className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-nexus-success backdrop-blur"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={vision.stop}
                  title="Turn off camera"
                  className="absolute right-2 top-2 rounded border border-nexus-blue/40 bg-black/50 px-2 text-nexus-blue/80 backdrop-blur hover:text-nexus-danger"
                >
                  ✕
                </button>
                {!vision.ready && (
                  <span className="absolute inset-x-0 bottom-2 text-center text-[10px] text-nexus-cyan/70">
                    loading vision models…
                  </span>
                )}
                {vision.error && (
                  <span className="absolute inset-x-0 bottom-2 text-center text-[10px] text-nexus-danger">
                    {vision.error}
                  </span>
                )}
              </>
            )}
          </div>
        </Panel>

        <Panel title="AI Avatar" status={voice.speaking ? "speaking" : thinking ? "thinking" : "idle"}>
          <Avatar speaking={voice.speaking || thinking} />
        </Panel>

        <Panel title="System Intelligence">
          <ul className="space-y-1 text-[11px] text-nexus-blue/80">
            {subsystems.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-2">
                <span className="truncate">{s.name}</span>
                <span
                  className={
                    s.implemented ? "text-nexus-success" : "text-nexus-blue/40"
                  }
                >
                  {s.implemented ? "online" : `P${s.phase}`}
                </span>
              </li>
            ))}
            {subsystems.length === 0 && (
              <li className="text-nexus-blue/40">Awaiting backend…</li>
            )}
          </ul>
        </Panel>

        <Panel title="Conversation" className="col-span-2">
          <Conversation messages={messages} thinking={thinking && !messages.at(-1)?.content} />
        </Panel>

        <Panel title="Emotion Analysis" status={vision.enabled && vision.faceDetected ? "from camera" : undefined}>
          <EmotionPanel
            current={vision.enabled && vision.faceDetected ? vision.mood : emotion}
            summary={emotionSummary}
          />
        </Panel>
      </main>

      {/* ── Voice wave + input + modes ──────────────────────────── */}
      <footer className="relative z-10 shrink-0 border-t border-nexus-blue/20 px-4 py-1.5">
        <Waveform active={active} />
        {voice.interim ? (
          <p className="mt-1 text-center text-xs italic text-nexus-cyan/60">“{voice.interim}”</p>
        ) : voice.state === "sleeping" ? (
          <p className="mt-1 text-center text-[11px] text-nexus-blue/40">
            Listening for “Hey RIYA”…
          </p>
        ) : voice.state === "active" ? (
          <p className="mt-1 text-center text-[11px] text-nexus-cyan/70">● Listening — go ahead</p>
        ) : null}
        {error && <p className="mt-1 text-center text-xs text-nexus-danger">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-1.5 flex gap-2">
          {voice.supported.stt && (
            <button
              type="button"
              onClick={() => (voice.awake ? voice.stop() : voice.start())}
              title={
                voice.awake
                  ? "Voice on — say “Hey RIYA”. Click to turn off."
                  : "Turn on hands-free voice"
              }
              className={`rounded-lg border px-4 font-head text-[11px] uppercase tracking-widest transition ${
                voice.listening
                  ? "animate-pulse border-nexus-danger bg-nexus-danger/15 text-nexus-danger shadow-glow"
                  : voice.awake
                    ? "border-nexus-cyan bg-nexus-cyan/10 text-nexus-cyan shadow-glow-soft"
                    : "border-nexus-blue/30 text-nexus-blue/70 hover:border-nexus-cyan hover:text-nexus-cyan"
              }`}
            >
              {voice.listening ? "● Listening" : voice.awake ? "👂 Awake" : "🎙 Voice off"}
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Speak to RIYA…"
            className="flex-1 rounded-lg border border-nexus-blue/30 bg-nexus-panel/60 px-4 py-2 text-sm text-nexus-cyan placeholder-nexus-blue/40 outline-none focus:border-nexus-cyan focus:shadow-glow-soft"
          />
          <button
            type="submit"
            disabled={thinking}
            className="rounded-lg border border-nexus-cyan bg-nexus-cyan/15 px-5 font-head text-xs uppercase tracking-widest text-nexus-cyan shadow-glow-soft transition hover:bg-nexus-cyan/25 disabled:opacity-40"
          >
            Send
          </button>
        </form>

        <div className="mt-1.5 flex items-center justify-between gap-3">
          <ModeBar modes={modes} active={mode} onSelect={setMode} />
          {voice.supported.tts && (
            <button
              type="button"
              onClick={() => {
                if (voice.speaking) voice.stopSpeaking();
                setAutoSpeak((v) => !v);
              }}
              className={`shrink-0 rounded-md border px-3 py-1 font-head text-[11px] uppercase tracking-widest transition ${
                autoSpeak
                  ? "border-nexus-cyan bg-nexus-cyan/15 text-nexus-cyan shadow-glow"
                  : "border-nexus-blue/25 text-nexus-blue/60 hover:text-nexus-blue"
              }`}
            >
              {autoSpeak ? "🔊 Voice" : "🔇 Muted"}
            </button>
          )}
        </div>
      </footer>

      {/* ── Drawers ─────────────────────────────────────────────── */}
      <Drawer open={drawer === "memory"} title="Memory" onClose={() => setDrawer(null)}>
        <MemoryPanel
          activeSessionId={sessionId}
          onResume={resumeSession}
          onNewSession={newSession}
        />
      </Drawer>
      <Drawer open={drawer === "agent"} title="AI Agent — Planner" onClose={() => setDrawer(null)}>
        <AgentPanel />
      </Drawer>
      <Drawer open={drawer === "tools"} title="Tools" onClose={() => setDrawer(null)}>
        <ToolsPanel onSpeak={(t) => autoSpeak && voice.speak(t)} />
      </Drawer>
    </div>
  );
}
