// Client for the RIYA backend. Base URL can be overridden via Vite env
// (VITE_RIYA_API) for packaged builds; defaults to the local dev server.
const BASE = import.meta.env.VITE_RIYA_API || "http://127.0.0.1:8000";

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${method} ${path} ${res.status} ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── System ────────────────────────────────────────────────────────
export const getHealth = () => api("/api/health");

// ── Chat ──────────────────────────────────────────────────────────
/**
 * Stream a chat reply via Server-Sent Events.
 * @param {object} payload  { messages, mode, session_id, use_memory, use_emotion }
 * @param {{onMeta?:fn, onToken?:fn, onDone?:fn}} handlers
 */
export async function streamChat(payload, handlers = {}) {
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`chat/stream ${res.status} ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const evt = JSON.parse(line.slice(5).trim());
      if (evt.type === "meta") handlers.onMeta?.(evt);
      else if (evt.type === "token") handlers.onToken?.(evt.text);
      else if (evt.type === "done") handlers.onDone?.(evt);
      else if (evt.type === "error") throw new Error(evt.detail);
    }
  }
}

// ── Memory: sessions ──────────────────────────────────────────────
export const listSessions = () => api("/api/memory/sessions");
export const createSession = (body = {}) =>
  api("/api/memory/sessions", { method: "POST", body });
export const getSessionMessages = (id) =>
  api(`/api/memory/sessions/${id}/messages`);
export const deleteSession = (id) =>
  api(`/api/memory/sessions/${id}`, { method: "DELETE" });

// ── Memory: facts + recall + emotions ─────────────────────────────
export const listFacts = (kind) =>
  api(`/api/memory/facts${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`);
export const upsertFact = (body) =>
  api("/api/memory/facts", { method: "POST", body });
export const deleteFact = (id) =>
  api(`/api/memory/facts/${id}`, { method: "DELETE" });
export const getEmotions = (sessionId) =>
  api(`/api/memory/emotions${sessionId ? `?session_id=${sessionId}` : ""}`);

// ── Emotion analysis ──────────────────────────────────────────────
export const analyzeEmotion = (text) =>
  api("/api/emotion/analyze", { method: "POST", body: { text } });

// ── Agent planner ─────────────────────────────────────────────────
export const planGoal = (goal) =>
  api("/api/agent/plan", { method: "POST", body: { goal } });

// ── Settings ──────────────────────────────────────────────────────
export const getSettings = () => api("/api/settings");
export const putSetting = (key, value) =>
  api("/api/settings", { method: "PUT", body: { key, value } });
