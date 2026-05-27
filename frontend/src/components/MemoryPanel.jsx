import { useEffect, useState } from "react";
import {
  listSessions,
  deleteSession,
  listFacts,
  upsertFact,
  deleteFact,
} from "../api/client";

const FACT_KINDS = ["preference", "routine", "fact", "emotional", "skill"];

// Memory surface: switch between stored Sessions and long-term Facts.
export default function MemoryPanel({ activeSessionId, onResume, onNewSession }) {
  const [tab, setTab] = useState("sessions");
  const [sessions, setSessions] = useState([]);
  const [facts, setFacts] = useState([]);
  const [form, setForm] = useState({ kind: "preference", key: "", value: "" });
  const [err, setErr] = useState("");

  async function refresh() {
    try {
      const [s, f] = await Promise.all([listSessions(), listFacts()]);
      setSessions(s);
      setFacts(f);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function addFact(e) {
    e.preventDefault();
    if (!form.key.trim() || !form.value.trim()) return;
    try {
      await upsertFact(form);
      setForm({ ...form, key: "", value: "" });
      refresh();
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 rounded-md border px-3 py-1 font-head text-[11px] uppercase tracking-widest transition ${
        tab === id
          ? "border-nexus-cyan bg-nexus-cyan/15 text-nexus-cyan"
          : "border-nexus-blue/25 text-nexus-blue/60 hover:text-nexus-blue"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <div className="flex gap-2">
        {tabBtn("sessions", "Sessions")}
        {tabBtn("facts", "Facts")}
      </div>
      {err && <p className="text-xs text-nexus-danger">{err}</p>}

      {tab === "sessions" && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <button
            onClick={onNewSession}
            className="rounded-md border border-nexus-cyan bg-nexus-cyan/10 py-1.5 font-head text-[11px] uppercase tracking-widest text-nexus-cyan hover:bg-nexus-cyan/20"
          >
            + New session
          </button>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {sessions.length === 0 && (
              <li className="text-xs text-nexus-blue/40">No saved sessions yet.</li>
            )}
            {sessions.map((s) => (
              <li
                key={s.id}
                className={`group flex items-center justify-between rounded-md border px-2 py-1.5 ${
                  s.id === activeSessionId
                    ? "border-nexus-cyan/60 bg-nexus-cyan/10"
                    : "border-nexus-blue/20"
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onResume(s.id)}
                  title={s.title}
                >
                  <span className="block truncate text-nexus-cyan/90">{s.title}</span>
                  <span className="text-[10px] text-nexus-blue/40">
                    {s.mode} · {s.updated_at}
                  </span>
                </button>
                <button
                  onClick={async () => {
                    await deleteSession(s.id);
                    refresh();
                  }}
                  className="ml-2 text-nexus-blue/30 opacity-0 transition group-hover:opacity-100 hover:text-nexus-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "facts" && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <form onSubmit={addFact} className="flex flex-col gap-1.5">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-2 py-1 text-xs text-nexus-cyan"
            >
              {FACT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="key (e.g. editor)"
              className="rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-2 py-1 text-xs text-nexus-cyan placeholder-nexus-blue/40"
            />
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="value (e.g. VS Code)"
              className="rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-2 py-1 text-xs text-nexus-cyan placeholder-nexus-blue/40"
            />
            <button className="rounded-md border border-nexus-cyan bg-nexus-cyan/10 py-1 font-head text-[11px] uppercase tracking-widest text-nexus-cyan hover:bg-nexus-cyan/20">
              Remember
            </button>
          </form>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {facts.length === 0 && (
              <li className="text-xs text-nexus-blue/40">Nothing remembered yet.</li>
            )}
            {facts.map((f) => (
              <li
                key={f.id}
                className="group flex items-center justify-between rounded-md border border-nexus-blue/20 px-2 py-1.5"
              >
                <span className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-nexus-purple/80">
                    {f.kind}
                  </span>
                  <span className="block truncate text-nexus-cyan/90">
                    {f.key}: {f.value}
                  </span>
                </span>
                <button
                  onClick={async () => {
                    await deleteFact(f.id);
                    refresh();
                  }}
                  className="ml-2 text-nexus-blue/30 opacity-0 transition group-hover:opacity-100 hover:text-nexus-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
