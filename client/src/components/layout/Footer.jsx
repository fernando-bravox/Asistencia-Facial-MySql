import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-brand-border mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-brand-primary/10 p-2 rounded-lg">
              <div className="h-4 w-4 bg-brand-primary rounded-full animate-pulse"></div>
            </div>
            <span className="font-bold text-brand-dark tracking-tight text-lg">Asistencia Facial</span>
          </div>

          <div className="flex items-center gap-8 text-sm font-semibold text-brand-gray">
            <Link to="/app/privacy" className="hover:text-brand-primary transition-colors">Privacidad</Link>
            <Link to="/app/terms" className="hover:text-brand-primary transition-colors">Términos</Link>
            <Link to="/app/cookies" className="hover:text-brand-primary transition-colors">Cookies</Link>
          </div>

          <p className="text-sm font-medium text-brand-gray/60">
            © {new Date().getFullYear()} • Sistema de Gestión Escolar
          </p>
        </div>
      </div>
    </footer>
  );
}
