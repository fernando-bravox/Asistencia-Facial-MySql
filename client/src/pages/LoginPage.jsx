import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, setToken } from "../api/client.js";
import Toast from "../components/Toast.jsx";

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
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
        <h1>Iniciar sesión</h1>
        <p className="muted">Admin / Profesor / Estudiante</p>
        <Toast type={msg.type} message={msg.text} />
        <form onSubmit={onSubmit}>
          <label className="label">Correo</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
          <div style={{ height: 10 }} />
          <label className="label">Contraseña</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          <div style={{ height: 16 }} />
          <button className="btn" disabled={loading} type="submit">{loading ? "Entrando..." : "Entrar"}</button>
        </form>
        <hr />
        <div className="muted">
          ¿Eres estudiante y no tienes cuenta? <Link to="/register" style={{ color: "var(--accent)" }}>Regístrate</Link>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>
          Admin demo: <b>admin@demo.com</b> / <b>Admin123*</b>
        </div>
      </div>
    </div>
  );
}
