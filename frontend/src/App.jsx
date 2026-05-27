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

const SESSION_KEY = "riya.sessionId";

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

  const voice = useVoice({ onFinalTranscript: (text) => sendMessage(text) });

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
      <header className="relative z-10 flex items-center justify-between border-b border-nexus-blue/20 px-6 py-3">
        <h1 className="font-head text-2xl tracking-[0.4em] text-nexus-cyan drop-shadow-[0_0_10px_rgba(34,224,224,0.6)]">
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
          <span className={brainOnline ? "text-nexus-success" : "text-nexus-danger"}>
            ● Brain {brainOnline ? "Online" : health ? "Offline-stub" : "—"}
          </span>
          {health?.model && <span className="text-nexus-blue/70">{health.model}</span>}
        </div>
      </header>

      {/* ── HUD grid ────────────────────────────────────────────── */}
      <main className="relative z-10 grid flex-1 grid-cols-3 grid-rows-2 gap-4 p-4">
        <Panel title="Camera Feed" status="standby">
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-nexus-blue/30 text-xs text-nexus-blue/50">
            Vision module — Phase 3
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

        <Panel title="Emotion Analysis">
          <EmotionPanel current={emotion} summary={emotionSummary} />
        </Panel>
      </main>

      {/* ── Voice wave + input + modes ──────────────────────────── */}
      <footer className="relative z-10 border-t border-nexus-blue/20 px-4 py-3">
        <Waveform active={active} />
        {voice.interim && (
          <p className="mt-1 text-center text-xs italic text-nexus-cyan/60">“{voice.interim}”</p>
        )}
        {error && <p className="mt-1 text-center text-xs text-nexus-danger">{error}</p>}

        <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
          {voice.supported.stt && (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stopListening() : voice.startListening())}
              title={voice.listening ? "Stop listening" : "Speak to RIYA"}
              className={`rounded-lg border px-4 font-head text-xs uppercase tracking-widest transition ${
                voice.listening
                  ? "animate-pulse border-nexus-danger bg-nexus-danger/15 text-nexus-danger shadow-glow"
                  : "border-nexus-blue/30 text-nexus-blue/70 hover:border-nexus-cyan hover:text-nexus-cyan"
              }`}
            >
              {voice.listening ? "● Rec" : "🎙 Mic"}
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

        <div className="mt-3 flex items-center justify-between gap-3">
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
    </div>
  );
}
