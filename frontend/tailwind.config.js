/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // support class-based dark mode
  theme: {
    extend: {
      colors: {
        hospital: {
          50: '#f0f6ff',
          100: '#e0efff',
          200: '#b8d6ff',
          300: '#7ab3ff',
          400: '#338bff',
          500: '#0066f5',
          600: '#004ec7',
          700: '#003a99',
          800: '#003180',
          900: '#06204d',
        },
        slate: {
          850: '#1e293b',
          950: '#0f172a'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
