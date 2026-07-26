import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Wacaco brand palette taken from the reference design.
        brand: {
          DEFAULT: '#E1580E',
          50: '#FEF4EC',
          100: '#FCE3D1',
          200: '#F8C09B',
          300: '#F39C64',
          400: '#EC7A36',
          500: '#E1580E',
          600: '#C1470A',
          700: '#993808',
          800: '#6E2806',
          900: '#451903',
        },
        ink: {
          DEFAULT: '#1C1B1A',
          soft: '#3D3B38',
          muted: '#726E68',
        },
        sand: {
          DEFAULT: '#F0EFEA',
          dark: '#E4E2DB',
        },
        olive: '#8A8C7A',
      },
      fontFamily: {
        display: ['Oswald', 'Arial Narrow', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        site: '1600px',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        fadeIn: 'fadeIn .5s ease-out both',
        slideUp: 'slideUp .45s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
