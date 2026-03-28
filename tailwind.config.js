/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f7f7f5',
          100: '#eceae6',
          200: '#d9d5cd',
          300: '#c0b9ac',
          400: '#a69d8d',
          500: '#8d8272',
          600: '#746a5c',
          700: '#5c5349',
          800: '#4a443c',
          900: '#3d3833',
          950: '#201e1a',
        },
        paper: {
          50: '#fdfcfa',
          100: '#faf8f4',
          200: '#f5f1ea',
          300: '#ece6db',
          400: '#e0d7c8',
        },
        accent: {
          DEFAULT: '#c45d3e',
          light: '#e07b5f',
          dark: '#9e4a31',
        },
      },
    },
  },
  plugins: [],
};
