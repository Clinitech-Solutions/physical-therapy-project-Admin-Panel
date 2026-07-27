module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'navy-bg': '#0f172a',
        'light-bg': '#f4f6f8',
        'teal-accent': '#0f766e',
        'teal-light': '#14b8a6',
        'alert-amber': '#f59e0b',
      },
      borderRadius: {
        'capsule': '100px',
      }
    },
  },
  plugins: [],
}