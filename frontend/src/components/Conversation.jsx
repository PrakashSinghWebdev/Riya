import { useEffect, useRef } from "react";

// Scrolling transcript of the RIYA conversation.
export default function Conversation({ messages, thinking }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1 text-sm">
      {messages.length === 0 && (
        <p className="text-nexus-blue/50">
          RIYA is online. Ask anything, or pick a mode below.
        </p>
      )}
      {messages.map((m, i) =>
        // Skip the not-yet-filled assistant bubble; the thinking indicator covers it.
        m.role === "assistant" && !m.content ? null : (
        <div
          key={i}
          className={m.role === "user" ? "text-right" : "text-left"}
        >
          <span
            className={`inline-block max-w-[85%] rounded-lg px-3 py-2 ${
              m.role === "user"
                ? "bg-nexus-blue/15 text-nexus-blue"
                : "bg-nexus-purple/10 text-nexus-cyan"
            }`}
          >
            {m.content}
          </span>
        </div>
      ))}
      {thinking && (
        <div className="text-left text-nexus-cyan/60">
          <span className="inline-block rounded-lg bg-nexus-purple/10 px-3 py-2">
            Analyzing your request now…
          </span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
