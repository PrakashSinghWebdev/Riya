import { useState } from "react";
import { planGoal } from "../api/client";

// Agent planner surface: enter a goal, get an ordered plan (planning only —
// the backend never executes steps).
export default function AgentPanel() {
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(e) {
    e.preventDefault();
    if (!goal.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      setResult(await planGoal(goal.trim()));
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <p className="text-xs text-nexus-blue/60">
        Give RIYA a goal. She plans the steps — execution stays gated (Phase 4).
      </p>
      <form onSubmit={run} className="flex flex-col gap-2">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          placeholder="e.g. Prepare a revision plan for my physics exam"
          className="resize-none rounded-md border border-nexus-blue/30 bg-nexus-panel/60 px-3 py-2 text-sm text-nexus-cyan placeholder-nexus-blue/40 outline-none focus:border-nexus-cyan"
        />
        <button
          disabled={busy}
          className="rounded-md border border-nexus-cyan bg-nexus-cyan/15 py-1.5 font-head text-[11px] uppercase tracking-widest text-nexus-cyan hover:bg-nexus-cyan/25 disabled:opacity-40"
        >
          {busy ? "Planning…" : "Generate plan"}
        </button>
      </form>
      {err && <p className="text-xs text-nexus-danger">{err}</p>}

      {result && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!result.online && (
            <p className="mb-2 text-[11px] text-nexus-purple/70">
              Offline stub plan — set OPENAI_API_KEY for a tailored plan.
            </p>
          )}
          <ol className="space-y-2">
            {result.steps.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-md border border-nexus-blue/20 px-3 py-2"
              >
                <span className="font-head text-nexus-cyan">{i + 1}.</span>
                <span className="text-nexus-blue/90">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
