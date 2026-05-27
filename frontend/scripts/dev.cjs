// One-command dev launcher for RIYA: `npm run dev`.
//
// Starts everything the app needs and wires them together:
//   1. Ollama server      (local AI model, :11434)
//   2. FastAPI backend     (the brain, :8000)
//   3. Vite dev server     (the HUD bundle, :5173)
//   4. Electron window     (the HUD itself)
//
// Anything already running on its port is reused (so re-running is safe), and
// Electron is launched with a clean env so it works from inside VS Code.
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");

const FRONTEND = path.join(__dirname, "..");
const BACKEND = path.join(FRONTEND, "..", "backend");
const children = [];

function log(tag, msg) {
  console.log(`\x1b[36m[dev:${tag}]\x1b[0m ${msg}`);
}

function spawnChild(tag, cmd, args, opts = {}) {
  const p = spawn(cmd, args, { stdio: "inherit", ...opts });
  p.on("error", (e) => console.error(`[dev:${tag}] ${e.message}`));
  children.push(p);
  return p;
}

function portOpen(port) {
  // Use "localhost" (not a hard-coded 127.0.0.1) so Node tries both IPv4 and
  // IPv6 — Vite often binds to ::1 on Windows, which a 127.0.0.1-only check
  // would miss.
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "localhost" });
    const done = (v) => {
      s.destroy();
      resolve(v);
    };
    s.setTimeout(1000);
    s.on("connect", () => done(true));
    s.on("timeout", () => done(false));
    s.on("error", () => done(false));
  });
}

async function waitPort(port, tries = 80) {
  for (let i = 0; i < tries; i++) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function pythonPath() {
  const win = path.join(BACKEND, ".venv", "Scripts", "python.exe");
  const nix = path.join(BACKEND, ".venv", "bin", "python");
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(nix)) return nix;
  return "python";
}

(async () => {
  // 1. Ollama
  if (await portOpen(11434)) {
    log("ollama", "already running — reusing");
  } else {
    log("ollama", "starting…");
    // Keep the model resident so replies stay instant (no cold reloads).
    spawnChild("ollama", "ollama", ["serve"], {
      shell: true,
      env: { ...process.env, OLLAMA_KEEP_ALIVE: "30m" },
    });
  }

  // 2. Backend
  if (await portOpen(8000)) {
    log("api", "already running on :8000 — reusing");
  } else {
    log("api", "starting FastAPI…");
    spawnChild("api", pythonPath(), ["run.py"], {
      cwd: BACKEND,
      env: { ...process.env, RIYA_RELOAD: "false" },
    });
  }

  // 3. Vite
  if (await portOpen(5173)) {
    log("vite", "already running on :5173 — reusing");
  } else {
    log("vite", "starting dev server…");
    spawnChild("vite", process.execPath, [
      path.join(FRONTEND, "node_modules", "vite", "bin", "vite.js"),
    ], { cwd: FRONTEND });
  }

  // 4. Electron — wait for the UI to be served first.
  log("app", "waiting for the HUD bundle…");
  if (!(await waitPort(5173))) {
    console.error("[dev] Vite never came up on :5173 — aborting.");
    return shutdown(1);
  }
  const env = { ...process.env, ELECTRON_START_URL: "http://localhost:5173" };
  // VS Code sets these; they make Electron run as plain Node. Strip them.
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  const electronBin = require("electron");
  log("app", "launching RIYA HUD…");
  const app = spawnChild("app", electronBin, [FRONTEND], { env });
  // When the window closes, tear everything down.
  app.on("close", (code) => {
    log("app", `HUD window closed (exit ${code}) — shutting down.`);
    shutdown(0);
  });
})();

function shutdown(code = 0) {
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
