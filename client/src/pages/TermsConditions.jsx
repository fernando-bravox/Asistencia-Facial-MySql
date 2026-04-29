import React from "react";
import { useNavigate } from "react-router-dom";

export default function TermsConditions() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-brand-border">
        <div className="bg-brand-primary p-10 text-center">
          <h1 className="text-4xl font-black text-white tracking-tighter">Términos y Condiciones</h1>
          <p className="text-white/80 font-bold uppercase tracking-widest mt-2 text-sm">Condiciones de Uso del Sistema</p>
        </div>
        
        <div className="p-10 space-y-8 text-brand-dark leading-relaxed">
          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">1. Ámbito de Aplicación</h2>
            <p className="font-medium text-brand-gray text-justify">
              Este sistema de Asistencia Facial es la herramienta oficial para el control de asistencia en las asignaturas asignadas a la plataforma. Su uso es obligatorio para todos los estudiantes matriculados en dichas materias, y la falta de registro biométrico será considerada como inasistencia injustificada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">2. Reglas de Asistencia y Puntualidad</h2>
            <p className="font-medium text-brand-gray text-justify">
              El sistema opera bajo los siguientes parámetros estrictos:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-2 font-medium text-brand-gray ml-4 text-justify">
              <li><strong>Ventana de Registro:</strong> El estudiante debe registrar su asistencia en el intervalo de tiempo configurado por el docente (usualmente los primeros 15 minutos de clase).</li>
              <li><strong>Registros Aleatorios:</strong> El sistema puede solicitar capturas faciales adicionales en cualquier momento durante la sesión para validar la permanencia.</li>
              <li><strong>Atrasos:</strong> Los registros realizados fuera del periodo de gracia se marcarán automáticamente como "Atrasado" o "Falta".</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">3. Honestidad Académica y Sanciones</h2>
            <p className="font-medium text-brand-gray text-justify">
              Cualquier intento de engañar al sistema (uso de fotos, máscaras o suplantación de identidad) constituye una falta grave. Los casos detectados serán remitidos al Consejo de Facultad para la aplicación de las sanciones correspondientes, que pueden incluir la anulación de la materia o la suspensión temporal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-primary mb-4">4. Requerimientos del Usuario</h2>
            <p className="font-medium text-brand-gray text-justify">
              Es responsabilidad del usuario contar con un dispositivo (computadora o celular) con cámara funcional y una conexión a internet estable. Los problemas técnicos individuales no eximen al estudiante de su responsabilidad de registro, debiendo reportarlos al docente de inmediato por otros medios institucionales.
            </p>
          </section>

          <div className="pt-8 border-t border-brand-border flex justify-center">
            <button onClick={() => navigate(-1)} className="btn btn-dark !px-10">ACEPTAR Y REGRESAR</button>
          </div>
        </div>
      </div>
    </div>
  );
}
