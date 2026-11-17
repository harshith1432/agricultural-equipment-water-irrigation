/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emeraldGlow: {
          light: '#34D399',
          DEFAULT: '#10B981',
          dark: '#059669',
          glow: 'rgba(16, 185, 129, 0.35)'
        },
        amberPulse: {
          light: '#FBBF24',
          DEFAULT: '#F59E0B',
          dark: '#D97706',
          glow: 'rgba(245, 158, 11, 0.35)'
        },
        crimsonCoral: {
          light: '#F87171',
          DEFAULT: '#EF4444',
          dark: '#DC2626',
          glow: 'rgba(239, 68, 68, 0.35)'
        },
        slateGraphite: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        fieldSoil: {
          DEFAULT: '#854d0e',
          dark: '#451a03'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ripple': 'ripple 2s linear infinite',
        'flow': 'flow 1.5s ease-in-out infinite',
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(0.8)', opacity: '1' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        flow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' }
        }
      }
    },
  },
  plugins: [],
}
