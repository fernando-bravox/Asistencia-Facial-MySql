import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, setToken } from "../api/client.js";
import { showAlert } from "../utils/swalHelper.js";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [faceId, setFaceId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleBlockedClick() {
    showAlert("info", "Acceso Restringido", "Solo el administrador puede registrar nuevos usuarios desde el panel de gestión.");
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      return showAlert("error", "Error", "La contraseña debe tener al menos 8 caracteres");
    }
    handleBlockedClick();
    return;
    // ... resto del código bloqueado
  }

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Contenedor Principal Split Layout */}
      <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row-reverse min-h-[auto] lg:min-h-[80vh]">
        
        {/* Lado Derecho: Branding e Imagen (Visible en Desktop) */}
        <div className="hidden lg:flex lg:w-1/2 bg-brand-dark relative overflow-hidden p-12 flex-col justify-between text-right">
          {/* Decoración de fondo */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px] -ml-48 -mt-48 animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand-secondary/20 rounded-full blur-[80px] -mr-32 -mb-32"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-end gap-4 mb-12">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tighter leading-none">ASISTENCIA</h2>
                <p className="text-brand-primary text-xs font-black uppercase tracking-[0.3em]">Facial App</p>
              </div>
              <div className="bg-brand-primary p-3 rounded-2xl shadow-lg shadow-brand-primary/20">
                <img src="/img/log.png" alt="Logo" className="h-10 w-auto" />
              </div>
            </div>

            <h1 className="text-5xl font-black text-white tracking-tight leading-[1.1] mb-6">
              Sistema de <span className="text-brand-primary">Gestión Central</span> de la ESPOCH.
            </h1>
            <p className="text-white/60 text-lg font-medium max-w-md ml-auto">
              El registro de nuevos perfiles ahora se realiza exclusivamente a través del administrador del sistema.
            </p>
          </div>

          <div className="relative z-10">
             <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-4">
                Seguridad y Control Institucional
              </p>
          </div>
        </div>

        {/* Lado Izquierdo: Formulario */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-16 relative">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-left-8 duration-700">
            {/* Botón Volver y Header Móvil (Móvil) */}
            <div className="lg:hidden flex items-center justify-between mb-10">
              <Link to="/login" className="flex items-center gap-2 text-brand-gray hover:text-brand-primary transition-colors group">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-xs font-black uppercase tracking-widest">Volver</span>
              </Link>
              
              <div className="flex items-center gap-2">
                <div className="bg-brand-primary p-1.5 rounded-lg">
                  <img src="/img/log.png" alt="Logo" className="h-5 w-auto" />
                </div>
                <h2 className="text-sm font-black text-brand-dark tracking-tighter leading-none">ASISTENCIA</h2>
              </div>
            </div>

            <div className="mb-8 text-center sm:text-left">
              <h3 className="text-4xl font-black text-brand-dark tracking-tight mb-2">Registro</h3>
              <p className="text-brand-gray font-bold">Módulo de alta de usuarios desactivado</p>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-8 rounded-r-2xl shadow-sm">
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-1">Aviso del Sistema</p>
                  <p className="text-xs text-amber-900 font-bold leading-relaxed">
                    Solo el administrador puede registrar nuevos usuarios. Por favor, solicite su alta directamente en el departamento técnico.
                  </p>
                </div>
              </div>
            </div>
            
            <form onSubmit={onSubmit} className="space-y-4 opacity-60 grayscale pointer-events-none select-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre Completo</label>
                  <input 
                    className="input" 
                    value={name} 
                    readOnly
                    placeholder="Bloqueado"
                  />
                </div>
                <div>
                  <label className="label">Correo Institucional</label>
                  <input 
                    className="input" 
                    readOnly
                    placeholder="Bloqueado"
                  />
                </div>
              </div>

              <div>
                <label className="label">Código Estudiantil</label>
                <input 
                  className="input font-mono" 
                  readOnly
                  placeholder="Bloqueado"
                />
              </div>

              <div>
                <label className="label">Contraseña</label>
                <input 
                  className="input" 
                  readOnly
                  placeholder="Bloqueado"
                />
              </div>

              <button 
                className="btn btn-dark w-full !py-5 mt-4 text-base tracking-[0.2em] cursor-not-allowed" 
                type="button"
                onClick={handleBlockedClick}
              >
                REGISTRO DESHABILITADO
              </button>
            </form>

            <div className="mt-10 text-center" onClick={handleBlockedClick}>
              <p className="text-sm font-bold text-brand-gray">
                ¿Ya tienes una cuenta?{" "}
                <Link to="/login" className="text-brand-primary font-black hover:underline underline-offset-4 pointer-events-auto">
                  INICIA SESIÓN
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
