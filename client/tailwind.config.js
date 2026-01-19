/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/*/.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#050507",      // negro profundo
          panel: "#0B0B10",   // negro panel
          card: "#0F1117",    // negro/azul oscuro
          border: "rgba(255,255,255,0.10)",
          text: "#F5F5F7",    // blanco suave
          muted: "rgba(245,245,247,0.65)",
          red: "#EF4444",     // rojo principal
          red2: "#DC2626"     // rojo fuerte
        }
      }
    }
  },
  plugins: []
};