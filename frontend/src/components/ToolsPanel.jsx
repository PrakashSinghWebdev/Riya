import { useEffect, useState } from "react";
import {
  research,
  translate,
  listReminders,
  createReminder,
  completeReminder,
  deleteReminder,
  proposeAction,
  executeAction,
} from "../api/client";

const LANGS = ["English", "Hindi", "Spanish", "French", "German", "Japanese", "Arabic"];

// Consolidated "Tools" surface: Research, Translate, Automation, Reminders.
export default function ToolsPanel({ onSpeak }) {
  const [tab, setTab] = useState("research");
  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 rounded-md border px-2 py-1 font-head text-[10px] uppercase tracking-widest transition ${
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
      <div className="flex gap-1.5">
        {tabBtn("research", "🌐 Research")}
        {tabBtn("translate", "🌍 Translate")}
        {tabBtn("automation", "⚙ Automate")}
        {tabBtn("reminders", "⏰ Reminders")}
      </div>
      {tab === "research" && <Research onSpeak={onSpeak} />}
      {tab === "translate" && <Translate onSpeak={onSpeak} />}
      {tab === "automation" && <Automation />}
      {tab === "reminders" && <Reminders />}
    </div>
  );
}

function Research({ onSpeak }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    if (!q.trim() || busy) return;
    setBusy(true);
    try {
      const r = await research(q.trim());
      setRes(r);
      onSpeak?.(r.answer);
    } catch (err) {
      setRes({ answer: String(err.message || err), sources: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <form onSubmit={go} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask the web…"
          className="flex-1 rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-3 py-1.5 text-xs text-nexus-cyan placeholder-nexus-blue/40 outline-none focus:border-nexus-cyan"
        />
        <button
          disabled={busy}
          className="rounded-md border border-nexus-cyan bg-nexus-cyan/15 px-3 font-head text-[10px] uppercase tracking-widest text-nexus-cyan disabled:opacity-40"
        >
          {busy ? "…" : "Search"}
        </button>
      </form>
      {res && (
        <div className="min-h-0 flex-1 overflow-y-auto text-xs">
          <p className="whitespace-pre-wrap text-nexus-blue/90">{res.answer}</p>
          {res.sources?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {res.sources.map((s, i) => (
                <li key={i} className="truncate">
                  <span className="text-nexus-purple">[{i + 1}]</span>{" "}
                  <span className="text-nexus-blue/60">{s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Translate({ onSpeak }) {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("Hindi");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await translate(text.trim(), lang);
      setOut(r.translation);
      onSpeak?.(r.translation);
    } catch (err) {
      setOut(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={go} className="flex min-h-0 flex-1 flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Text to translate…"
        className="resize-none rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-3 py-2 text-xs text-nexus-cyan placeholder-nexus-blue/40 outline-none focus:border-nexus-cyan"
      />
      <div className="flex gap-2">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-2 py-1 text-xs text-nexus-cyan"
        >
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          className="flex-1 rounded-md border border-nexus-cyan bg-nexus-cyan/15 py-1 font-head text-[10px] uppercase tracking-widest text-nexus-cyan disabled:opacity-40"
        >
          {busy ? "Translating…" : "Translate"}
        </button>
      </div>
      {out && (
        <p className="min-h-0 flex-1 overflow-y-auto rounded-md border border-nexus-blue/20 p-2 text-sm text-nexus-cyan">
          {out}
        </p>
      )}
    </form>
  );
}

function Automation() {
  const [req, setReq] = useState("");
  const [proposal, setProposal] = useState(null); // only set for destructive confirm
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(e) {
    e.preventDefault();
    if (!req.trim() || busy) return;
    setBusy(true);
    setResult("");
    setProposal(null);
    try {
      const p = await proposeAction(req.trim());
      if (!p.action) {
        setResult(`✕ ${p.reason || p.label || "No safe action matched."}`);
        return;
      }
      if (p.destructive) {
        setProposal(p); // hold for explicit confirmation
        return;
      }
      const r = await executeAction(p.action, p.target, false);
      setResult(r.ok ? `✓ ${r.did}` : `✕ ${r.error}`);
    } catch (err) {
      setResult(`✕ ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRun() {
    const r = await executeAction(proposal.action, proposal.target, true);
    setResult(r.ok ? `✓ ${r.did}` : `✕ ${r.error}`);
    setProposal(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-[11px] text-nexus-blue/60">
        Tell RIYA to do something — open apps, type, click, switch windows. Routine
        actions run instantly; deleting/closing asks first.
      </p>
      <form onSubmit={run} className="flex gap-2">
        <input
          value={req}
          onChange={(e) => setReq(e.target.value)}
          placeholder="e.g. open notepad and type hello"
          className="flex-1 rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-3 py-1.5 text-xs text-nexus-cyan placeholder-nexus-blue/40 outline-none focus:border-nexus-cyan"
        />
        <button
          disabled={busy}
          className="rounded-md border border-nexus-cyan bg-nexus-cyan/15 px-3 font-head text-[10px] uppercase tracking-widest text-nexus-cyan disabled:opacity-40"
        >
          {busy ? "…" : "Run"}
        </button>
      </form>

      {proposal && (
        <div className="rounded-md border border-nexus-danger/50 bg-nexus-danger/10 p-2 text-xs">
          <p className="text-nexus-danger">⚠ Destructive action — confirm?</p>
          <p className="mt-0.5 text-nexus-cyan">{proposal.label}</p>
          <p className="text-[10px] text-nexus-blue/50">
            {proposal.action} → {String(proposal.target)}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={confirmRun}
              className="rounded border border-nexus-danger/60 bg-nexus-danger/20 px-3 py-0.5 font-head text-[10px] uppercase tracking-widest text-nexus-danger"
            >
              Confirm & run
            </button>
            <button
              onClick={() => setProposal(null)}
              className="rounded border border-nexus-blue/30 px-3 py-0.5 font-head text-[10px] uppercase tracking-widest text-nexus-blue/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {result && <p className="text-xs text-nexus-cyan/80">{result}</p>}
    </div>
  );
}

function Reminders() {
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");

  async function refresh() {
    try {
      setItems(await listReminders());
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await createReminder(text.trim(), due ? new Date(due).toISOString() : null);
    setText("");
    setDue("");
    refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <form onSubmit={add} className="flex flex-col gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Remind me to…"
          className="rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-3 py-1.5 text-xs text-nexus-cyan placeholder-nexus-blue/40 outline-none focus:border-nexus-cyan"
        />
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="flex-1 rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-2 py-1 text-xs text-nexus-cyan"
          />
          <button className="rounded-md border border-nexus-cyan bg-nexus-cyan/15 px-3 font-head text-[10px] uppercase tracking-widest text-nexus-cyan">
            Add
          </button>
        </div>
      </form>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {items.length === 0 && (
          <li className="text-xs text-nexus-blue/40">No reminders.</li>
        )}
        {items.map((r) => (
          <li
            key={r.id}
            className="group flex items-center justify-between gap-2 rounded-md border border-nexus-blue/20 px-2 py-1.5 text-xs"
          >
            <span className="min-w-0">
              <span className="block truncate text-nexus-cyan/90">{r.text}</span>
              {r.due_at && (
                <span className="text-[10px] text-nexus-blue/40">
                  {new Date(r.due_at).toLocaleString()}
                </span>
              )}
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                onClick={async () => {
                  await completeReminder(r.id);
                  refresh();
                }}
                title="Done"
                className="text-nexus-success/70 hover:text-nexus-success"
              >
                ✓
              </button>
              <button
                onClick={async () => {
                  await deleteReminder(r.id);
                  refresh();
                }}
                title="Delete"
                className="text-nexus-blue/30 hover:text-nexus-danger"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
