import React from "react";
import { useNavigate } from "react-router-dom";

export default function Topbar({ user }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const avatarSrc =
    user?.photoUrl ||
    `https://ui-avatars.com/api/?background=2563eb&color=fff&name=${encodeURIComponent(
      user?.name || "User"
    )}`;

  return (
    <header className="w-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 text-white shadow-md">
      <div className="mx-auto w-full max-w-6xl px-4 py-3">
        {/* Contenedor responsive */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          
          {/* IZQUIERDA: Logo + Nombre */}
          <div className="flex items-center gap-3">
            <img
  src="/img/logo1.png"
  alt="Logo"
  className="h-16 w-16 rounded-xl object-top shadow-md ring-2 ring-blue-500/30"
/>



            <div className="leading-tight">
              <div className="text-1xl sm:text-2xl lg:text-3xl font-black tracking-wider text-white drop-shadow-md">
  ASISTENCIA FACIAL
</div>

              <div className="text-xs sm:text-sm text-white/80">
                ESCUELA SUPERIOR POLITÉCNICA DE CHIMBORAZO
              </div>
            </div>
          </div>

          {/* DERECHA: Usuario + Logout */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Usuario */}
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={avatarSrc}
                alt="avatar"
                className="h-10 w-10 rounded-full border-2 border-white/30 object-cover"
              />

              <div className="min-w-0">
                <div className="text-sm sm:text-base font-bold uppercase truncate">
                  {user?.name || "USUARIO"}
                </div>
                <div className="text-xs text-white/80 truncate">
                  {user?.email || ""}
                </div>
              </div>
            </div>

            {/* Botón logout */}
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-xl bg-red-400 px-3 py-2 text-sm font-semibold
                         hover:bg-red-600 active:scale-[0.98] transition"
            >
              Cerrar sesión
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
