import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "../components/RequireAuth.jsx";
import Topbar from "../components/Topbar.jsx";
import Footer from "../components/layout/Footer.jsx";

import AdminUsers from "./dash/AdminUsers.jsx";
import ProfSubjects from "./dash/ProfSubjects.jsx";
import ProfSubjectDetail from "./dash/ProfSubjectDetail.jsx";
import StudentSubjects from "./dash/StudentSubjects.jsx";
import StudentSubjectDetail from "./dash/StudentSubjectDetail.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import TermsConditions from "./TermsConditions.jsx";
import CookiePolicy from "./CookiePolicy.jsx";

function WelcomeHeader({ user }) {
  let title = "Panel de Control";
  let subtitle = "Gestión de asistencia y reportes";

  if (user.role === "admin") {
    title = "Administración Central";
    subtitle = "Control global de usuarios y configuraciones.";
  } else if (user.role === "professor") {
    title = "Portal Docente";
    subtitle = "Gestión de clases y asistencias.";
  } else if (user.role === "student") {
    title = "Portal Estudiantil";
    subtitle = "Consulta de asistencias y horarios.";
  }

  return (
    <div 
      className="relative overflow-hidden rounded-[1.5rem] p-4 sm:p-6 mb-6 shadow-2xl bg-brand-primary"
    >
      {/* Patrón de fondo sutil para elegancia */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
      
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white px-3 py-1 rounded-full shadow-lg">
              <span className="text-[10px] font-bold uppercase tracking-widest text-black">
                SISTEMA ACTIVO
              </span>
            </span>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter leading-tight mb-1 drop-shadow-2xl">
            {title} - {user?.name} {user?.lastname || ""}
          </h2>
          <p className="text-white/80 font-medium text-sm sm:text-base max-w-md leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <div className="bg-white p-2.5 rounded-xl flex items-center gap-3 shadow-2xl transition-all hover:bg-slate-50 hover:translate-y-[-2px]">
            <div className="h-8 w-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <div>
              <p className="text-slate-900 font-black text-lg leading-none">Usuario</p>
              <p className="text-[8px] font-black uppercase tracking-widest mt-0.5 text-slate-500">Cargado</p>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl flex items-center gap-3 shadow-2xl transition-all hover:bg-slate-50 hover:translate-y-[-2px]">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 20c4.478 0 8.268-2.943 9.542-7H14l-1 1" />
                </svg>
            </div>
            <div>
              <p className="text-slate-900 font-black text-lg leading-none">Biométrico</p>
              <p className="text-[8px] font-black uppercase tracking-widest mt-0.5 text-slate-500">Activado</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <RequireAuth>
      {(user) => (
        <div className="min-h-screen flex flex-col bg-brand-light">
          <Topbar user={user} />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <WelcomeHeader user={user} />

              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                    element={
                      user.role === "admin" ? <AdminUsers /> : <Navigate to="/app" replace />
                    }
                  />

                  {/* PROF */}
                  <Route
                    path="prof/subjects"
                    element={
                      user.role === "professor" ? <ProfSubjects /> : <Navigate to="/app" replace />
                    }
                  />
                  <Route
                    path="prof/subjects/:id"
                    element={
                      user.role === "professor" ? <ProfSubjectDetail /> : <Navigate to="/app" replace />
                    }
                  />

                  {/* STUDENT */}
                  <Route
                    path="student/subjects"
                    element={
                      user.role === "student" ? <StudentSubjects /> : <Navigate to="/app" replace />
                    }
                  />
                  <Route
                    path="student/subjects/:id"
                    element={
                      user.role === "student" ? <StudentSubjectDetail /> : <Navigate to="/app" replace />
                    }
                  />

                  {/* LEGAL */}
                  <Route path="privacy" element={<PrivacyPolicy />} />
                  <Route path="terms" element={<TermsConditions />} />
                  <Route path="cookies" element={<CookiePolicy />} />

                  <Route
                    path="*"
                    element={
                      <div className="card text-center py-20">
                        <h2 className="text-4xl font-black text-brand-dark mb-4">404</h2>
                        <p className="text-brand-gray font-bold uppercase tracking-widest">Página no encontrada</p>
                      </div>
                    }
                  />
                </Routes>
              </div>
            </div>
          </main>

          <Footer />
        </div>
      )}
    </RequireAuth>
  );
}