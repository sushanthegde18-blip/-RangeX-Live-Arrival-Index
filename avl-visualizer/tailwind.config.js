/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#06070a',
        charcoal: {
          950: '#0b0d12',
          900: '#10141c',
          850: '#151b26',
          800: '#1b2230',
          700: '#263042',
        },
        electric: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        cyanpulse: {
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(59, 130, 246, 0.25)',
        cyanGlow: '0 0 20px rgba(34, 211, 238, 0.2)',
      },
    },
  },
  plugins: [],
};
