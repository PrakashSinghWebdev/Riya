// Mode selector. Modes are loaded from the backend /api/health response so the
// UI stays in sync with the server's mode registry.
export default function ModeBar({ modes, active, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((m) => {
        const on = m.key === active;
        return (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            title={m.description}
            className={`rounded-md border px-3 py-1 font-head text-[11px] uppercase tracking-widest transition
              ${
                on
                  ? "border-nexus-cyan bg-nexus-cyan/15 text-nexus-cyan shadow-glow"
                  : "border-nexus-blue/25 text-nexus-blue/70 hover:border-nexus-blue/60 hover:text-nexus-blue"
              }`}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
