import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaSignOutAlt, FaHome, FaUsers, FaBook, FaGraduationCap } from "react-icons/fa";

export default function Topbar({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const menuItems = {
    admin: [
      { path: "/app/admin/users", label: "Usuarios", icon: <FaUsers /> },
    ],
    professor: [
      { path: "/app/prof/subjects", label: "Asignaturas", icon: <FaBook /> },
    ],
    student: [
      { path: "/app/student/subjects", label: "Mis Materias", icon: <FaGraduationCap /> },
    ]
  };

  const items = menuItems[user?.role] || [];

  const roleNames = {
    admin: "Administrador",
    professor: "Profesor",
    student: "Estudiante"
  };

  const fullName = `${user?.name || ""} ${user?.lastname || ""}`.trim();
  const initials = (fullName || "U")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header 
      className="w-full sticky top-0 z-[50] shadow-2xl bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-28 gap-4">
          {/* Logo y Nombre */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="bg-brand-light rounded-2xl shadow-md border border-brand-border h-20 w-20 flex items-center justify-center overflow-hidden">
              <img src="/img/log.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-2xl font-black text-brand-dark tracking-tighter leading-none uppercase">Asistencia</h2>
              <p className="text-brand-primary text-[13px] font-black uppercase tracking-[0.3em]">Facial App</p>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-base transition-all duration-300 
                  ${location.pathname === item.path 
                    ? 'bg-[#E53E3E] text-white' 
                    : 'text-brand-dark hover:bg-brand-primary/10 hover:text-brand-primary'
                  }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Perfil y Salir */}
          <div className="flex items-center gap-4">
            <div className="text-right flex flex-col items-end">
              <div className="text-sm font-black text-brand-dark truncate leading-none mb-1 uppercase tracking-tighter max-w-[150px] sm:max-w-[250px]">
                {user?.name} {user?.lastname || ""}
              </div>
              <div className="hidden sm:inline-flex items-center bg-brand-light text-brand-primary px-2.5 py-1 rounded-xl text-[11px] font-black uppercase border border-brand-primary/20">
                {roleNames[user?.role] || user?.role}
              </div>
              <div className="sm:hidden text-[10px] font-bold text-brand-gray truncate max-w-[120px]">
                {user?.email}
              </div>
            </div>

            <div className="h-11 w-11 rounded-2xl bg-brand-light border border-brand-border flex items-center justify-center text-brand-primary text-sm font-black shadow-inner overflow-hidden">
               {user?.image ? <img src={user.image} alt="Avatar" className="w-full h-full object-cover" /> : initials}
            </div>

            <div className="h-8 w-px bg-brand-border mx-1"></div>

            <button
              onClick={handleLogout}
              className="bg-brand-primary p-3 rounded-2xl text-white shadow-lg shadow-brand-primary/30 hover:scale-105 active:scale-95 transition-all"
              title="Cerrar Sesión"
            >
              <FaSignOutAlt size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Navegación Móvil */}
      <nav className="md:hidden flex items-center justify-center gap-2 pb-3 px-4 overflow-x-auto">
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-300
              ${location.pathname === item.path 
                ? 'bg-brand-primary text-white shadow-md' 
                : 'bg-brand-light text-brand-dark hover:bg-brand-primary/10'
              }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}