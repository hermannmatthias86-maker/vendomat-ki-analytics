/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0d1b2a',
          800: '#1a2d42',
          700: '#243548',
          600: '#2e4057',
        },
      },
    },
  },
  plugins: [],
}

