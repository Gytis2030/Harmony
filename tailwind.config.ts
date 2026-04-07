import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#111118',
        border: '#262637',
        brand: '#6D5EF8',
        muted: '#9F9FB6'
      },
      boxShadow: {
        soft: '0 12px 30px rgba(0, 0, 0, 0.35)'
      }
    }
  },
  plugins: []
};

export default config;
