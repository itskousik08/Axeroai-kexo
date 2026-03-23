import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fff8ed',
          100: '#ffefd4',
          200: '#ffdba8',
          300: '#ffc16b',
          400: '#ff9c2c',
          500: '#f5a623',
          600: '#e88a0a',
          700: '#c06a09',
          800: '#98520f',
          900: '#7c4410',
          950: '#432005',
        },
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease',
        'slide-up':   'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'scale-in':   'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                            to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.92)' },  to: { opacity: '1', transform: 'scale(1)' } },
      },
      boxShadow: {
        'brand': '0 4px 24px rgba(245,166,35,0.35)',
        'node':  '0 2px 16px rgba(0,0,0,0.18)',
        'node-hover': '0 4px 32px rgba(0,0,0,0.28)',
      },
    },
  },
  plugins: [],
}
export default config
