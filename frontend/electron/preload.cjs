// Preload bridge. Currently exposes only RIYA metadata; native capabilities
// (camera, mic, file access, OS automation) will be surfaced here in later
// phases via a tightly-scoped contextBridge API.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("riya", {
  platform: process.platform,
  version: "0.1.0",
});
