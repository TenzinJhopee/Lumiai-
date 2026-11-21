import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#142238",
        muted: "#728096",
        brand: "#d92e3a",
        canvas: "#f6f7f9",
        line: "#e9edf1"
      },
      boxShadow: {
        card: "0 8px 26px rgba(20, 34, 56, 0.045)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
