// Animated voice waveform. `active` drives the pulsing animation; when idle
// the bars rest flat. Real audio amplitude can be wired in later.
export default function Waveform({ active = false, bars = 28 }) {
  return (
    <div className="flex h-8 items-end justify-center gap-1">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-1 rounded-full bg-gradient-to-t from-nexus-blue to-nexus-cyan ${
            active ? "animate-pulseWave" : ""
          }`}
          style={{
            height: active ? `${20 + ((i * 37) % 60)}%` : "12%",
            animationDelay: `${(i % 10) * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}
