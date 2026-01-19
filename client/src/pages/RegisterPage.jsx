import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, setToken } from "../api/client.js";
import Toast from "../components/Toast.jsx";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [faceId, setFaceId] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState({ type: "ok", text: "" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "ok", text: "" });
    try {
      const data = await api("/api/auth/register", { method: "POST", auth: false, body: { name, email, password, faceId: faceId || null } });
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
        <h1>Registro (Estudiante)</h1>
        <p className="muted">Solo estudiantes se registran aquí. Profesores/Admin los crea el Admin.</p>
        <Toast type={msg.type} message={msg.text} />
        <form onSubmit={onSubmit}>
          <label className="label">Nombre completo</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
          <div style={{ height: 10 }} />
          <label className="label">Correo</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
          <div style={{ height: 10 }} />
          <label className="label">FaceId (opcional)</label>
          <input className="input" value={faceId} onChange={e => setFaceId(e.target.value)} placeholder="Ej: face-001" />
          <div style={{ height: 10 }} />
          <label className="label">Contraseña</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <div style={{ height: 16 }} />
          <button className="btn" disabled={loading} type="submit">{loading ? "Creando..." : "Crear cuenta"}</button>
        </form>
        <hr />
        <div className="muted">
          ¿Ya tienes cuenta? <Link to="/login" style={{ color: "var(--accent)" }}>Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
}
