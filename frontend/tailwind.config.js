/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#0f0f1a',
        surface: '#1a1a2e',
        'surface-2': '#16213e',
        'surface-3': '#0f3460',
        accent: '#6c63ff',
        'accent-cyan': '#00d4ff',
        'rag-green': '#22c55e',
        'rag-yellow': '#eab308',
        'rag-red': '#ef4444',
        'text-primary': '#e2e8f0',
        'text-muted': '#94a3b8',
        'text-dim': '#8896aa',
        border: '#2d2d4e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 0 24px rgba(108, 99, 255, 0.2)',
        'glow-cyan': '0 0 24px rgba(0, 212, 255, 0.15)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
