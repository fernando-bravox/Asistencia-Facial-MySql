import React from "react";
import { Link } from "react-router-dom";

export default function Header({ title = "Asistencia Facial", subtitle = "Panel administrativo" }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0F14]/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-white font-semibold text-lg truncate">{title}</h1>
          <p className="text-[#94A3B8] text-sm truncate">{subtitle}</p>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            to="/admin/users"
            className="px-3 py-2 rounded-lg text-sm text-white/90 hover:text-white hover:bg-white/5 transition"
          >
            Usuarios
          </Link>

          <Link
            to="/admin/asistencia"
            className="px-3 py-2 rounded-lg text-sm text-white/90 hover:text-white hover:bg-white/5 transition"
          >
            Asistencia
          </Link>

          <Link
            to="/logout"
            className="px-3 py-2 rounded-lg text-sm bg-[#EF4444] hover:bg-[#DC2626] text-white transition"
          >
            Salir
          </Link>
        </nav>
      </div>
    </header>
  );
}
