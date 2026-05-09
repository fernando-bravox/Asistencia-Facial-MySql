import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, setToken } from "../api/client.js";
import { showAlert } from "../utils/swalHelper.js";
import backgroundImg from "../assets/images/background.png"; // Asegúrate de que esta ruta sea correcta
import logoImg from "../assets/images/logo111.png"; // Ruta de la imagen para el logo

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api("/api/auth/login", { method: "POST", auth: false, body: { email, password } });
      setToken(data.token);
      showAlert("success", "¡Bienvenido!", "Iniciando sesión...");
      setTimeout(() => {
        window.location.href = "/app";
      }, 1500);
    } catch (err) {
      showAlert("error", "Error de acceso", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Contenedor Principal Split Layout */}
      <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[auto] lg:min-h-[80vh]">
        
        {/* Lado Izquierdo: Branding e Imagen (Visible en Desktop) */}
        <div className="hidden lg:flex lg:w-1/2 bg-brand-dark relative overflow-hidden p-12 flex-col justify-between">
          {/* Decoración de fondo */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px] -mr-48 -mt-48"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-secondary/20 rounded-full blur-[80px] -ml-32 -mb-32"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-12">
              <div className="bg-brand-primary p-3 rounded-2xl shadow-lg shadow-brand-primary/20">
                <img src={logoImg} alt="Logo" className="h-10 w-auto" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tighter leading-none">ASISTENCIA</h2>
                <p className="text-brand-primary text-xs font-black uppercase tracking-[0.3em]">Facial App</p>
              </div>
            </div>

            <h1 className="text-5xl font-black text-white tracking-tight leading-[1.1] mb-6">
              El futuro de la <span className="text-brand-primary">asistencia escolar</span> está aquí.
            </h1>
            <p className="text-white/60 text-lg font-medium max-w-md">
              Gestiona el control de acceso de forma rápida, segura y moderna con tecnología de reconocimiento facial de última generación.
            </p>
          </div>

          

          {/* Imagen de fondo sutil */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `url(${backgroundImg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          ></div>
        </div>

        {/* Lado Derecho: Formulario */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-20 relative">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-right-8 duration-700">
            {/* Header Móvil (Solo visible en pantallas pequeñas) */}
            <div className="lg:hidden flex items-center gap-3 mb-12 justify-center sm:justify-start">
               <div className="bg-brand-primary p-2 rounded-xl">
                  <img src={logoImg} alt="Logo" className="h-6 w-auto" />
                </div>
                <h2 className="text-lg font-black text-brand-dark tracking-tighter leading-none">ASISTENCIA</h2>
            </div>

            <div className="mb-10 text-center lg:text-left">
              <h3 className="text-3xl sm:text-4xl font-black text-brand-dark tracking-tight mb-2">Iniciar Sesión</h3>
              <p className="text-brand-gray font-bold">Ingresa tus credenciales para continuar</p>
            </div>
            
            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <label className="label">Correo Institucional</label>
                <div className="relative group">
                  <input
                    className="input !pl-14"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@espoch.edu.ec"
                    required
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray group-focus-within:text-brand-primary transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Contraseña</label>
                <div className="relative group">
                  <input
                    className="input !pl-14"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                  />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray group-focus-within:text-brand-primary transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary" />
                  <span className="text-xs font-bold text-brand-gray group-hover:text-brand-dark transition-colors">Recordarme</span>
                </label>
                <Link to="/forgot-password" size="xs" className="text-xs font-black text-brand-primary hover:text-red-700 transition-colors">¿Olvidaste tu contraseña?</Link>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-primary w-full !py-5 text-base tracking-[0.2em]"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>AUTENTICANDO...</span>
                  </div>
                ) : (
                  "ENTRAR AL SISTEMA"
                )}
              </button>
            </form>

            <div className="mt-12 text-center">
              <p className="text-sm font-bold text-brand-gray uppercase tracking-widest opacity-50">
                Sistema de Gestión Institucional
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
