/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#DC2626",   // Rojo Normal (Red 600)
          header: "#7F1D1D",    // Rojo Muy Oscuro para Header (Red 900)
          secondary: "#2563EB", // Azul para acentos/iconos (Blue 600)
          dark: "#0F172A",      // Azul muy oscuro (Slate 900)
          panel: "#1E293B",     // Gris oscuro para paneles (Slate 800)
          light: "#F8FAFC",     // Fondo muy claro (Slate 50)
          gray: "#64748B",      // Gris medio (Slate 500)
          border: "#E2E8F0",    // Borde (Slate 200)
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'modern': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'red-glow': '0 0 20px rgba(220, 38, 38, 0.15)',
      }
    }
  },
  plugins: []
};