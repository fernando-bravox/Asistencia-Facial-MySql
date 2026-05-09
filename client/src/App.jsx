import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";

// Importa tus páginas internas:
import AdminUsers from "./pages/dash/AdminUsers.jsx";
import ProfSubjects from "./pages/dash/ProfSubjects.jsx";
import ProfSubjectDetail from "./pages/dash/ProfSubjectDetail.jsx";
import StudentSubjects from "./pages/dash/StudentSubjects.jsx";
import StudentSubjectDetail from "./pages/dash/StudentSubjectDetail.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import TermsConditions from "./pages/TermsConditions.jsx";
import CookiePolicy from "./pages/CookiePolicy.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* ✅ Layout padre */}
      <Route path="/app/*" element={<Dashboard />}>
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="prof/subjects" element={<ProfSubjects />} />
        <Route path="prof/subjects/:id" element={<ProfSubjectDetail />} />
        <Route path="student/subjects" element={<StudentSubjects />} />
        <Route path="student/subjects/:id" element={<StudentSubjectDetail />} />
        <Route path="privacy" element={<PrivacyPolicy />} />
        <Route path="terms" element={<TermsConditions />} />
        <Route path="cookies" element={<CookiePolicy />} />
      </Route>

      <Route
        path="*"
        element={
          <div className="container">
            <div className="card">404</div>
          </div>
        }
      />
    </Routes>
  );
}
