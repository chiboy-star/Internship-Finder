import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          light: "#F6F2EA",
          dark: "#0F0E0D",
        },
        ink: {
          light: "#14110F",
          dark: "#EDE7DB",
        },
        hairline: {
          light: "#D9D2C5",
          dark: "#2A2724",
        },
        muted: {
          light: "#6B6258",
          dark: "#9A9184",
        },
        brass: {
          light: "#B08A3E",
          dark: "#C9A35B",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Playfair Display", "Cormorant Garamond", "serif"],
        sans: ["var(--font-sans)", "Inter", "Instrument Sans", "sans-serif"],
      },
      borderRadius: {
        outer: "12px",
        inner: "8px",
      },
      letterSpacing: {
        label: "0.12em",
      },
      transitionDuration: {
        editorial: "200ms",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

