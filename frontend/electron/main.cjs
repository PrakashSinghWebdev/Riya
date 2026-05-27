// Electron main process — creates the frameless dark HUD window.
const { app, BrowserWindow, session } = require("electron");
const path = require("path");

// In dev we load the Vite server; in production we load the built bundle.
const START_URL = process.env.ELECTRON_START_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#05070d",
    title: "RIYA NEXUS",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (START_URL) {
    win.loadURL(START_URL);
    // DevTools is opt-in (set RIYA_DEVTOOLS=1) — auto-opening it on top of the
    // HUD just clutters the screen with harmless internal warnings.
    if (process.env.RIYA_DEVTOOLS) {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  // Allow the HUD to use the webcam/microphone (Vision + voice). Electron
  // denies media by default; we grant it for our own local app.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === "media");
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
