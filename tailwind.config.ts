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
        money: { DEFAULT: c("money"), soft: c("money-soft"), line: c("money-line") },
        delivered: { DEFAULT: c("delivered"), soft: c("delivered-soft"), line: c("delivered-line") },
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
        // `font-serif`, `font-display` and `font-accent` all resolve to the display face (Fraunces).
        serif: ["var(--font-serif)", "Georgia", "serif"],
        display: ["var(--font-serif)", "Georgia", "serif"],
        accent: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // Landfall is square-cornered on purpose: panels, buttons and labels read like a survey chart / logbook,
      // not the rounded glass pills most dashboards use. `full` is kept only for dots and meters.
      borderRadius: {
        sm: "2px",
        DEFAULT: "2px",
        md: "3px",
        lg: "3px",
        xl: "4px",
        "2xl": "4px",
        "3xl": "6px",
        "4xl": "6px",
        "5xl": "8px",
      },
      keyframes: {
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
        "sweep": "sweep 6s linear infinite",
        "shimmer": "shimmer 3s linear infinite",
        "ping-soft": "ping-soft 2.2s cubic-bezier(0,0,0.2,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
