import type { Config } from 'tailwindcss';

/** NovaTech Hub design tokens — a single palette both light and dark themes inherit. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface))',
          raised: 'rgb(var(--surface-raised))',
          overlay: 'rgb(var(--surface-overlay))',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink))',
          muted: 'rgb(var(--ink-muted))',
          faint: 'rgb(var(--ink-faint))',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          warm: 'rgb(var(--accent-warm))',
          cool: 'rgb(var(--accent-cool))',
          rose: 'rgb(var(--accent-rose))',
        },
        line: 'rgb(var(--line))',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px rgb(0 0 0 / 0.08), 0 2px 6px rgb(0 0 0 / 0.06)',
        'card-lg': '0 4px 12px -2px rgb(0 0 0 / 0.12), 0 12px 32px -8px rgb(0 0 0 / 0.18)',
        'card-hover': '0 8px 20px -4px rgb(99 102 241 / 0.15), 0 16px 40px -8px rgb(0 0 0 / 0.2)',
        glow: '0 0 20px rgb(99 102 241 / 0.3)',
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
        'rise-in': 'rise-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop-in': 'pop-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.8s linear infinite',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
    },
  },
  plugins: [],
} satisfies Config;