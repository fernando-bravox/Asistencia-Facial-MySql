import React from "react";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";

export default function AppLayout({ children, headerTitle, headerSubtitle }) {
  return (
    <div className="min-h-screen bg-[#0B0F14] text-white flex flex-col">
      <Header title={headerTitle} subtitle={headerSubtitle} />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
