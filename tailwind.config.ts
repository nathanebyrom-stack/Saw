import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-blue": {
          DEFAULT: "#1E5AF6",
          light: "#4C7BFF",
          dark: "#1443C4",
        },
        graphite: {
          DEFAULT: "#2B2F36",
          deep: "#14161A",
        },
        "off-white": "#F5F7FA",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      maxWidth: {
        "8xl": "90rem",
      },
      backgroundImage: {
        "grain": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
        "mesh-blue": "radial-gradient(at 20% 20%, rgba(30,90,246,0.35) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(30,90,246,0.25) 0px, transparent 50%), radial-gradient(at 50% 80%, rgba(43,47,54,0.4) 0px, transparent 50%)",
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-3%, 2%) scale(1.05)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "dash": {
          to: { strokeDashoffset: "0" },
        },
      },
      animation: {
        drift: "drift 18s ease-in-out infinite",
        "pulse-soft": "pulse-soft 3s ease-in-out infinite",
        marquee: "marquee 30s linear infinite",
        dash: "dash 2.5s ease-out forwards",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
