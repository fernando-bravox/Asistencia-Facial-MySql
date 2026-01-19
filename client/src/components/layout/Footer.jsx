import React from "react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0B0F14]">
      <div className="mx-auto max-w-6xl px-4 py-4 text-sm text-[#94A3B8] flex items-center justify-between gap-3">
        <span>© {new Date().getFullYear()} Asistencia Facial</span>
      </div>
    </footer>
  );
}
