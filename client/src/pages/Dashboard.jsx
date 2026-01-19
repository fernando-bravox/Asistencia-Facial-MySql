import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "../components/RequireAuth.jsx";
import Topbar from "../components/Topbar.jsx";

import AdminUsers from "./dash/AdminUsers.jsx";
import ProfSubjects from "./dash/ProfSubjects.jsx";
import ProfSubjectDetail from "./dash/ProfSubjectDetail.jsx";
import StudentSubjects from "./dash/StudentSubjects.jsx";
import StudentSubjectDetail from "./dash/StudentSubjectDetail.jsx";

function Nav({ user }) {
  // ✅ Título por rol
  let title = "Panel";
  let subtitle = "Administración del sistema";

  if (user.role === "admin") {
    title = "Administración";
    subtitle = "Gestiona usuarios, roles y accesos del sistema";
  } else if (user.role === "professor") {
    title = "Panel Docente";
    subtitle = "Gestiona tus materias y revisa información";
  } else if (user.role === "student") {
    title = "Panel Estudiantil";
    subtitle = "Consulta tus materias y revisa detalles";
  }

  return (
    <div className="mb-6">
      {/* ✅ Header de módulo (CLARO + AZUL) */}
      <div className="rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            {/* ✅ TÍTULO: pequeño + MAYÚSCULA */}
            <h1 className="h2">
  {title.toUpperCase()}
</h1>



            {/* ✅ Subtítulo: normal */}
            <p className="h3">
              {subtitle}
            </p>
          </div>

          {/* ✅ Chip de rol (AZUL, no rojo) */}
          <div className="inline-flex items-center gap-2 self-start md:self-auto rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            <span className="text-sm text-slate-700">
              Rol: <b className="text-slate-900">{user.role}</b>
            </span>
          </div>
        </div>

        {/* ✅ Línea decorativa (AZUL) */}
        <div className="mt-5 h-[2px] w-full bg-gradient-to-r from-blue-600 via-blue-300 to-transparent" />
      </div>
    </div>
  );

}

export default function Dashboard() {
  return (
    <RequireAuth>
      {(user) => (
        // ✅ SIN NEGRO, el fondo lo maneja app.css o este gris clarito
        <div className="min-h-screen bg-slate-100 text-slate-900">
          {/* ✅ HEADER FULL WIDTH */}
          <Topbar user={user} />

          {/* ✅ CONTENIDO CENTRADO */}
          <main className="mx-auto w-full max-w-6xl px-4 py-6">
            <Nav user={user} />

            <Routes>
              <Route
                path="/"
                element={
                  user.role === "admin"
                    ? <Navigate to="/app/admin/users" replace />
                    : user.role === "professor"
                      ? <Navigate to="/app/prof/subjects" replace />
                      : <Navigate to="/app/student/subjects" replace />
                }
              />

              {/* ADMIN */}
              <Route
                path="admin/users"
                element={user.role === "admin" ? <AdminUsers /> : <Navigate to="/app" replace />}
              />

              {/* PROF */}
              <Route
                path="prof/subjects"
                element={user.role === "professor" ? <ProfSubjects /> : <Navigate to="/app" replace />}
              />
              <Route
                path="prof/subjects/:id"
                element={user.role === "professor" ? <ProfSubjectDetail /> : <Navigate to="/app" replace />}
              />

              {/* STUDENT */}
              <Route
                path="student/subjects"
                element={user.role === "student" ? <StudentSubjects /> : <Navigate to="/app" replace />}
              />
              <Route
                path="student/subjects/:id"
                element={user.role === "student" ? <StudentSubjectDetail /> : <Navigate to="/app" replace />}
              />

              <Route
                path="*"
                element={
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-800 shadow-sm">
                    Ruta no encontrada
                  </div>
                }
              />
            </Routes>
          </main>

          {/* ✅ FOOTER */}
          <footer className="mt-10 border-t border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-4 text-sm text-slate-500 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
              <span>© {new Date().getFullYear()} Asistencia App</span>
              <span className="text-slate-400">
                Sistema de asistencia con reconocimiento facial
              </span>
            </div>
          </footer>
        </div>
      )}
    </RequireAuth>
  );
}
