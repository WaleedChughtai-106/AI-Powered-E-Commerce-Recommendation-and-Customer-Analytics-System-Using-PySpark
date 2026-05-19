/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        /* Shadcn semantic tokens — read from CSS variables so light/dark
           swap is automatic. */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Quantuma brand palette — exact hex per design spec.
        brand: {
          emerald: "#10b981",
          mint:    "#34d399",
          neon:    "#6ee7b7",
          deep:    "#059669",       // NEW — deep emerald accent
          purple:  "#a78bfa",
          blue:    "#60a5fa",
          coral:   "#f87171",
          amber:   "#fbbf24",
        },
        // Premium light surfaces (referenced by Tailwind utilities like
        // `bg-light-base`, `bg-light-elevated` — used only inside the few
        // places we need a hard-coded white-mode surface in JSX).
        light: {
          base:      "#F7FAF9",
          elevated:  "#FFFFFF",
          secondary: "#F1F5F3",
          frost:     "rgba(255,255,255,0.72)",
        },
        // Original dark surface tones — kept for components that still
        // reference `bg-surface-1` etc. directly.
        surface: {
          0: "#0a0b0d",
          1: "#101216",
          2: "#161a20",
          3: "#1c2129",
          4: "#242b35",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        /* Each shadow comes in two flavours.
           - `*-dark`  for explicit dark contexts (kept for legacy callers).
           - `*-light` for light mode (used in the new design system). */
        glow: "0 0 40px -10px rgba(16, 185, 129, 0.35)",
        "glow-mint": "0 0 48px -10px rgba(52, 211, 153, 0.45)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 24px rgba(0,0,0,0.4)",
        "card-soft":   "0 1px 2px rgba(15,23,42,0.04), 0 4px 18px rgba(15,23,42,0.06)",
        "card-float":  "0 4px 12px rgba(15,23,42,0.06), 0 18px 48px -12px rgba(15,23,42,0.10)",
        "ring-emerald":"0 0 0 4px rgba(52,211,153,0.20)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        "emerald-glow":
          "radial-gradient(circle at 50% 0%, rgba(16,185,129,0.18), transparent 60%)",
        /* New light-mode ambient effects. */
        "mesh-light":
          "radial-gradient(at 12% 0%, rgba(52,211,153,0.16), transparent 45%), radial-gradient(at 88% 14%, rgba(110,231,183,0.14), transparent 50%), radial-gradient(at 50% 100%, rgba(16,185,129,0.10), transparent 55%)",
        "mint-glow":
          "radial-gradient(circle at 50% 0%, rgba(52,211,153,0.18), transparent 60%)",
        "emerald-gradient":
          "linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "lift": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-2px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.4s ease-out",
        shimmer:          "shimmer 2.5s linear infinite",
        "lift":           "lift 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};