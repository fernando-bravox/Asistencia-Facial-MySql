import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, getToken } from "../api/client.js";

export default function RequireAuth({ children }) {
  const [state, setState] = useState({ loading: true, user: null, error: null });

  useEffect(() => {
    const t = getToken();
    if (!t) { setState({ loading: false, user: null, error: null }); return; }

    api("/api/auth/me").then(data => {
      setState({ loading: false, user: data.user, error: null });
    }).catch(() => {
      setState({ loading: false, user: null, error: "No autenticado" });
    });
  }, []);

  if (state.loading) return <div className="container"><div className="card">Cargando...</div></div>;
  if (!state.user) return <Navigate to="/login" replace />;
  return children(state.user);
}
