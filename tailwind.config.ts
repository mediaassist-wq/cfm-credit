import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        tier: {
          D: "#94a3b8",
          C: "#60a5fa",
          B: "#34d399",
          A: "#fbbf24",
          S: "#f472b6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
