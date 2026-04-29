import React from "react";
import { useNavigate } from "react-router-dom";

export default function CookiePolicy() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-brand-border">
        <div className="bg-brand-primary p-10 text-center">
          <h1 className="text-4xl font-black text-white tracking-tighter">Política de Cookies</h1>
          <p className="text-white/80 font-bold uppercase tracking-widest mt-2 text-sm">Transparencia en el uso de datos</p>
        </div>
        
        <div className="p-10 space-y-8 text-brand-dark leading-relaxed">
          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">1. ¿Qué son las Cookies?</h2>
            <p className="font-medium text-brand-gray text-justify">
              Las cookies son pequeños archivos de texto que los sitios web almacenan en su dispositivo para recordar sus preferencias y mejorar su experiencia de usuario. En nuestra plataforma, las cookies son fundamentales para garantizar la seguridad y el correcto funcionamiento del sistema de asistencia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">2. Cookies Técnicas y de Sesión</h2>
            <p className="font-medium text-brand-gray text-justify">
              Utilizamos cookies estrictamente necesarias para:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-2 font-medium text-brand-gray ml-4 text-justify">
              <li><strong>Autenticación:</strong> Mantener su sesión activa de forma segura mientras navega por el panel.</li>
              <li><strong>Seguridad:</strong> Proteger sus datos contra accesos no autorizados y prevenir ataques de falsificación de solicitudes entre sitios (CSRF).</li>
              <li><strong>Preferencias:</strong> Recordar configuraciones básicas de la interfaz para que no tenga que reajustarlas en cada visita.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">3. Terceros y Analítica</h2>
            <p className="font-medium text-brand-gray text-justify">
              Nuestra aplicación es una herramienta institucional cerrada. <strong>No utilizamos cookies de publicidad de terceros ni rastreadores de marketing</strong>. Únicamente empleamos herramientas de análisis de rendimiento internas para monitorear la estabilidad del sistema y la carga de los modelos de reconocimiento facial.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">4. Control de Cookies</h2>
            <p className="font-medium text-brand-gray text-justify">
              Usted puede bloquear o eliminar las cookies a través de la configuración de su navegador. Sin embargo, tenga en cuenta que al desactivar las cookies técnicas, el sistema de autenticación dejará de funcionar y no podrá registrar su asistencia ni acceder a sus reportes.
            </p>
          </section>

          <div className="pt-8 border-t border-brand-border flex justify-center">
            <button onClick={() => navigate(-1)} className="btn btn-dark !px-10">REGRESAR AL PANEL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
