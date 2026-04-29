import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { api } from "../api/client.js";
import { showAlert } from "../utils/swalHelper.js";
import logoImg from "../assets/images/logo111.png";
import backgroundImg from "../assets/images/background.png";

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/forgot-password", { method: "POST", auth: false, body: { email } });
      showAlert("success", "¡Código Enviado!", "Revisa tu bandeja de entrada.");
      setStep(2);
    } catch (err) {
      showAlert("error", "Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/verify-code", { method: "POST", auth: false, body: { email, code } });
      setStep(3);
    } catch (err) {
      showAlert("error", "Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      return showAlert("error", "Error", "La contraseña debe tener al menos 8 caracteres");
    }
    if (password !== confirmPassword) {
      return showAlert("error", "Error", "Las contraseñas no coinciden");
    }
    setLoading(true);
    try {
      await api("/api/auth/reset-password", { method: "POST", auth: false, body: { email, code, newPassword: password } });
      showAlert("success", "¡Éxito!", "Tu contraseña ha sido actualizada.");
      navigate("/login");
    } catch (err) {
      showAlert("error", "Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-light flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[auto] lg:min-h-[80vh]">
        
        {/* Lado Izquierdo: Branding (Igual al Login) */}
        <div className="hidden lg:flex lg:w-1/2 bg-brand-dark relative overflow-hidden p-12 flex-col justify-between">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/20 rounded-full blur-[100px] -mr-48 -mt-48"></div>
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
              Recupera tu <span className="text-brand-primary">acceso</span> de forma segura.
            </h1>
            <p className="text-white/60 text-lg font-medium max-w-md">
              Sigue los pasos para restablecer tu contraseña y volver al sistema.
            </p>
          </div>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url(${backgroundImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
        </div>

        {/* Lado Derecho: Formularios por Pasos */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-20 relative">
          {/* Botón Regresar Flotante */}
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate("/login")}
            className="absolute top-8 left-8 flex items-center gap-2 text-brand-gray hover:text-brand-primary font-black transition-colors group"
          >
            <div className="bg-brand-light p-2 rounded-xl group-hover:bg-brand-primary/10 transition-colors">
              <FaArrowLeft />
            </div>
            <span className="text-sm uppercase tracking-widest">Regresar</span>
          </button>

          <div className="w-full max-w-md">
            
            <div className="mb-10 text-center lg:text-left">
              <h3 className="text-3xl sm:text-4xl font-black text-brand-dark tracking-tight mb-2">
                {step === 1 && "Recuperar Contraseña"}
                {step === 2 && "Verificar Código"}
                {step === 3 && "Nueva Contraseña"}
              </h3>
              <p className="text-brand-gray font-bold">
                {step === 1 && "Ingresa tu correo para recibir un código."}
                {step === 2 && `Hemos enviado un código a ${email}`}
                {step === 3 && "Ingresa tu nueva contraseña segura."}
              </p>
            </div>

            {step === 1 && (
              <form onSubmit={handleSendCode} className="space-y-6">
                <div>
                  <label className="label">Correo Institucional</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@espoch.edu.ec"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full">
                  {loading ? "ENVIANDO..." : "ENVIAR CÓDIGO"}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div>
                  <label className="label">Código de 6 dígitos</label>
                  <input
                    className="input text-center text-2xl tracking-[0.5em] font-black"
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full">
                  {loading ? "VERIFICANDO..." : "VERIFICAR CÓDIGO"}
                </button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label className="label">Nueva Contraseña</label>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                  />
                </div>
                <div>
                  <label className="label">Confirmar Contraseña</label>
                  <input
                    className="input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary w-full">
                  {loading ? "ACTUALIZANDO..." : "CAMBIAR CONTRASEÑA"}
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
