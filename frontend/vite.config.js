import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" so the built bundle loads correctly from the file:// protocol
// when packaged inside Electron.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
});
