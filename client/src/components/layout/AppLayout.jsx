import React from "react";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";

export default function AppLayout({ children, headerTitle, headerSubtitle }) {
  return (
    <div className="app-container">
      <Header title={headerTitle} subtitle={headerSubtitle} />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-6xl px-4">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
