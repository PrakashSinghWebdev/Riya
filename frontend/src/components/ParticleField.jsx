import { useMemo } from "react";

// Lightweight animated particle background — pure CSS animation, no canvas.
export default function ParticleField({ count = 40 }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 12,
        duration: 8 + Math.random() * 10,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-nexus-cyan/40"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            animation: `drift ${d.duration}s linear ${d.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
