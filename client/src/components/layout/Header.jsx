import React from "react";
import { Link } from "react-router-dom";

export default function Header({ title = "Asistencia Facial", subtitle = "Panel administrativo" }) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-brand-border">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-brand-primary p-2.5 rounded-2xl shadow-lg shadow-brand-primary/20 transform hover:scale-105 transition-transform duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-brand-dark font-extrabold text-xl tracking-tight">{title}</h1>
            <p className="text-brand-gray text-xs font-semibold uppercase tracking-widest">{subtitle}</p>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <Link
            to="/app/dashboard"
            className="px-4 py-2 rounded-xl text-sm font-bold text-brand-gray hover:text-brand-primary hover:bg-red-50 transition-all duration-200"
          >
            Inicio
          </Link>

          <div className="h-6 w-px bg-brand-border mx-1"></div>

          <Link
            to="/logout"
            className="btn btn-primary !py-2 !px-5"
          >
            Cerrar Sesión
          </Link>
        </nav>
      </div>
    </header>
  );
}
