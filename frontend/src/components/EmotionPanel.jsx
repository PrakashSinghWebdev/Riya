// Live emotion display: the current detected mood plus a recent-history
// breakdown (RIYA's emotional memory) fetched from the backend.
const EMOJI = {
  happy: "😊",
  sad: "😔",
  angry: "😠",
  stressed: "😰",
  excited: "🤩",
  tired: "😴",
  neutral: "🙂",
};

export default function EmotionPanel({ current, summary }) {
  const mood = current || summary?.dominant || "neutral";
  const counts = summary?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="flex h-full flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{EMOJI[mood] || "🙂"}</span>
        <span>
          <span className="block font-head uppercase tracking-widest text-nexus-cyan">
            {mood}
          </span>
          <span className="text-nexus-blue/40">current mood</span>
        </span>
      </div>
      <div className="mt-1 space-y-1">
        {Object.keys(counts).length === 0 && (
          <span className="text-nexus-blue/40">No emotional history yet.</span>
        )}
        {Object.entries(counts).map(([emo, n]) => (
          <div key={emo} className="flex items-center gap-2">
            <span className="w-16 text-nexus-blue/70">{emo}</span>
            <div className="h-1.5 flex-1 rounded bg-nexus-blue/10">
              <div
                className="h-full rounded bg-gradient-to-r from-nexus-cyan to-nexus-purple"
                style={{ width: `${(n / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
