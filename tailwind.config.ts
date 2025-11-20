import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        night: '#0b1120',
        neon: {
          pink: '#ff5faa',
          blue: '#4dd0e1',
          green: '#a3ffab'
        }
      },
      boxShadow: {
        glow: '0 0 25px rgba(77, 208, 225, 0.35)'
      }
    }
  },
  plugins: []
};

export default config;
