/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        counter: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          boxBadge: '#1D4ED8', // Royal Blue
          boxBadgeAlt: '#047857', // Emerald
          boxBadgeAmber: '#B45309', // Industrial Amber
          text: '#0F172A',
          subtext: '#475569'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
