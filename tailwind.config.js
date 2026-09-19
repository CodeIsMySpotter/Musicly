/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'subnautica-deep': '#01060c',
        'subnautica-panel': 'rgba(9, 19, 31, 0.85)',
        'subnautica-border': 'rgba(56, 189, 248, 0.15)',
        'subnautica-active': '#38bdf8',
        'subnautica-kick': '#f43f5e',
        'subnautica-snare': '#f59e0b',
        'subnautica-hat': '#facc15',
        'subnautica-crystal': '#2dd4bf',
        'subnautica-pad': '#a855f7',
        'subnautica-sub': '#3b82f6',
        'subnautica-lead': '#ef4444',
        'subnautica-keys': '#84cc16',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
        mono: ['"Roboto Mono"', 'monospace'],
      },
      backgroundImage: {
        'subnautica-gradient': 'radial-gradient(circle at top center, #06192e 0%, #01060c 100%)',
      }
    },
  },
  plugins: [],
}
