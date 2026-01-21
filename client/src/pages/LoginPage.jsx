import React, { useState } from "react";
import { api, setToken } from "../api/client.js";
import Toast from "../components/Toast.jsx";
import backgroundImg from "../assets/images/background.png"; // Asegúrate de que esta ruta sea correcta
import logoImg from "../assets/images/logo111.png"; // Ruta de la imagen para el logo

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState({ type: "ok", text: "" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "ok", text: "" });
    try {
      const data = await api("/api/auth/login", { method: "POST", auth: false, body: { email, password } });
      setToken(data.token);
      window.location.href = "/app";
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="min-h-screen relative bg-cover bg-center" 
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      {/* Header */}
<header className="flex items-center p-1 bg-white z-20 fixed top-0 left-0 right-0">
  {/* Texto a la izquierda (posicionado de manera absoluta) */}
  <div className="absolute left-4 text-lg font-medium text-black"></div>

  {/* Imagen centrada */}
  <div className="flex justify-center flex-1">
    <img 
      src={logoImg} // Usando la importación de la imagen
      alt="Logo Asistencia Facial"
      className="h-10" // Ajusta el tamaño de la imagen
    />
  </div>
</header>



      {/* Capa de desenfoque sobre la imagen de fondo */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "blur(8px)", // Desenfoque aplicado solo al fondo
          WebkitBackdropFilter: "blur(8px)", // Para compatibilidad con Safari
        }}
      />

      <div className="flex items-center justify-center min-h-screen relative z-10">
        <div className="bg-gray-100 p-8 rounded-lg shadow-lg w-full max-w-sm">
          {/* Imagen centrada */}
          <div className="flex justify-center flex-1">
            <img 
              src={logoImg} // Usando la importación de la imagen
              alt="Logo Asistencia Facial"
              className="h-20" // Ajusta el tamaño de la imagen
            />
          </div>

          <h1 className="text-2xl font-bold text-center mb-4">Iniciar sesión</h1>
          <Toast type={msg.type} message={msg.text} />
          <form onSubmit={onSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">Correo</label>
              <input
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">Contraseña</label>
              <input
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button
              className="w-full p-3 bg-red-700 text-white rounded-md hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={loading}
              type="submit"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white text-center py-2 mt-10 z-20 fixed bottom-0 left-0 right-0">
        <p className="text-sm font-light">&copy; 2026 ESPOCH. Todos los derechos reservados.</p>
      </footer>

    </div>
  );
}
