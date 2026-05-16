import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        lattice: {
          navy: "#001F3F",
          deep: "#12325C",
          primary: "#0056D2",
          electric: "#2B7BFF",
          accent: "#4DA3FF",
          muted: "#E8EEF5",
          surface: "#F4F7FB",
          border: "#D0DAE6",
        },
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex)", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-mono)", "IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(11, 31, 58, 0.06), 0 8px 24px rgba(11, 31, 58, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
