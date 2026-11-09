import type { Config } from "tailwindcss";

/** Map a token channel variable to a Tailwind colour that supports `/opacity`. */
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./studio/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: c("canvas"),
        surface: { DEFAULT: c("surface"), 2: c("surface-2"), 3: c("surface-3") },
        line: { DEFAULT: c("line"), strong: c("line-strong") },
        ink: { DEFAULT: c("ink"), 2: c("ink-2"), 3: c("ink-3") },
        "on-accent": c("on-accent"),
        accent: { DEFAULT: c("accent"), strong: c("accent-strong"), soft: c("accent-soft"), line: c("accent-line") },
        paypal: { DEFAULT: c("paypal"), soft: c("paypal-soft"), line: c("paypal-line") },
        ai: { DEFAULT: c("ai"), soft: c("ai-soft"), line: c("ai-line") },
        amber: { DEFAULT: c("amber"), soft: c("amber-soft"), line: c("amber-line") },
        storm: { DEFAULT: c("storm"), soft: c("storm-soft"), line: c("storm-line") },
        danger: { DEFAULT: c("danger"), soft: c("danger-soft"), line: c("danger-line") },

        // shadcn-style aliases used by a few legacy components
        background: c("canvas"),
        foreground: c("ink"),
        primary: { DEFAULT: c("accent"), foreground: c("on-accent") },
        secondary: { DEFAULT: c("surface-2"), foreground: c("ink-2") },
        muted: { DEFAULT: c("surface-2"), foreground: c("ink-3") },
        destructive: { DEFAULT: c("danger"), foreground: c("ink") },
        border: c("line"),
        input: c("line"),
        ring: c("accent"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Legacy `font-serif` headings now render in the display face.
        serif: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        accent: ["var(--font-accent)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(4%, -3%, 0) scale(1.08)" },
        },
        "sweep": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "shimmer": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "ping-soft": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "80%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
      animation: {
        "aurora-drift": "aurora-drift 18s ease-in-out infinite",
        "sweep": "sweep 6s linear infinite",
        "shimmer": "shimmer 3s linear infinite",
        "ping-soft": "ping-soft 2.2s cubic-bezier(0,0,0.2,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
