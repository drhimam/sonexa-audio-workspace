/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#10a37f',
          50: '#effdf7', 100: '#d8fbeb', 200: '#b4f5d8',
          300: '#82eabf', 400: '#46d79c', 500: '#10a37f',
          600: '#0c8c6d', 700: '#0d6f59', 800: '#0f5848', 900: '#10493d',
        },
        neutral: {
          DEFAULT: '#6b7280',
        },
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
        'soft-dark': '0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
      },
    },
  },
  plugins: [],
};
