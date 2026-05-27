/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // RIYA NEXUS palette
        nexus: {
          bg: "#05070d",
          panel: "#0a1020",
          blue: "#2fa8ff",
          cyan: "#22e0e0",
          purple: "#9b6bff",
          danger: "#ff4d5e",
          success: "#3ddc84",
        },
      },
      fontFamily: {
        head: ["Orbitron", "Exo 2", "ui-sans-serif", "system-ui"],
        body: ["Poppins", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 12px rgba(47,168,255,0.5), 0 0 30px rgba(34,224,224,0.2)",
        "glow-soft": "0 0 8px rgba(47,168,255,0.35)",
      },
      keyframes: {
        pulseWave: {
          "0%,100%": { opacity: "0.35", transform: "scaleY(0.4)" },
          "50%": { opacity: "1", transform: "scaleY(1)" },
        },
        drift: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-40px)" },
        },
      },
      animation: {
        pulseWave: "pulseWave 1.1s ease-in-out infinite",
        drift: "drift 12s linear infinite alternate",
      },
    },
  },
  plugins: [],
};
