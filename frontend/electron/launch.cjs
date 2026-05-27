// Launches the Electron GUI with a clean environment.
//
// When RIYA is developed from inside an Electron-based editor (e.g. VS Code),
// the parent sets ELECTRON_RUN_AS_NODE=1. Electron checks for the *presence*
// of that variable at C++ startup (before any JS runs), so it cannot be undone
// with `cross-env VAR=`. We must spawn Electron from a process whose env no
// longer contains it — which is exactly what this launcher does.
const { spawn } = require("child_process");
const path = require("path");

// Under plain Node, require("electron") resolves to the path of the binary.
const electronBinary = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const child = spawn(electronBinary, [path.join(__dirname, "..")], {
  stdio: "inherit",
  env,
});

child.on("close", (code) => process.exit(code ?? 0));
