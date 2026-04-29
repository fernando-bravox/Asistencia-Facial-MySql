import React, { useEffect, useState, useMemo, useRef } from "react";
import { api } from "../../api/client.js";
import { Link } from "react-router-dom";
import { showAlert } from "../../utils/swalHelper.js";
import html2canvas from "html2canvas";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WORK_DAYS = [1, 2, 3, 4, 5]; // Lun a Vie
const HOURS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
  "19:00", "20:00", "21:00"
];

export default function StudentSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [user, setUser] = useState(null);
  const scheduleRef = useRef(null);

  async function load() {
    try {
      const data = await api("/api/student/subjects");
      setSubjects(data.subjects);
      
      const profile = await api("/api/auth/me");
      setUser(profile.user);
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  async function downloadSchedule() {
    const element = scheduleRef.current;
    if (!element) return;

    try {
      showAlert("info", "Procesando", "Generando documento...");
      
      const printWindow = window.open('', '_blank');
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('');

      const content = element.innerHTML;
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Horario_${user?.name || 'Estudiante'}</title>
            ${styles}
            <style>
              @page { size: landscape; margin: 1cm; }
              body { background: white !important; padding: 0; margin: 0; font-family: sans-serif; }
              .table-wrap { overflow: visible !important; max-height: none !important; box-shadow: none !important; border: none !important; }
              table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #E2E8F0 !important; }
              th, td { border: 1px solid #E2E8F0 !important; }
              .sticky { position: static !important; background: #F8FAFC !important; }
              .bg-brand-primary { background-color: #DC2626 !important; -webkit-print-color-adjust: exact; }
              .text-white { color: white !important; }
              .badge { border: 1px solid #CBD5E1 !important; }
            </style>
          </head>
          <body>
            <div style="padding: 20px; border: 2px solid #DC2626; border-radius: 15px; margin: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #F1F5F9; padding-bottom: 15px;">
                <div>
                  <h1 style="margin: 0; color: #DC2626; font-size: 24px; font-weight: 900;">HORARIO ACADÉMICO</h1>
                  <p style="margin: 5px 0 0 0; color: #64748B; font-weight: bold; text-transform: uppercase; font-size: 10px; tracking: 2px;">Portal Estudiantil - Asistencia Facial</p>
                </div>
                <div style="text-align: right;">
                  <p style="margin: 0; font-weight: 900; color: #0F172A;">${user?.name} ${user?.lastname || ""}</p>
                  <p style="margin: 2px 0 0 0; color: #64748B; font-size: 11px;">Código: ${user?.studentCode || 'N/A'}</p>
                </div>
              </div>
              ${content}
              <div style="margin-top: 20px; text-align: center; color: #94A3B8; font-size: 9px; font-style: italic;">
                Generado el ${new Date().toLocaleString()} - Sistema de Asistencia Facial ESPOCH
              </div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 1000);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Cerramos cualquier alerta previa
      import('sweetalert2').then((Swal) => {
        Swal.default.close();
      });

    } catch (err) {
      console.error("Error generating document:", err);
      showAlert("error", "Error", "No se pudo generar el documento.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const scheduleData = useMemo(() => {
    const matrix = {};
    
    // Inicializar matriz con todas las horas y días
    HOURS.forEach(h => {
      matrix[h] = {};
      WORK_DAYS.forEach(d => {
        matrix[h][d] = [];
      });
    });

    subjects.forEach((s) => {
      (s.schedules || []).forEach((sc) => {
        const startH = sc.startTime.substring(0, 2) + ":00";
        // Si la hora de inicio existe en nuestras horas estándar
        if (matrix[startH] && matrix[startH][sc.dayOfWeek]) {
          matrix[startH][sc.dayOfWeek].push({
            name: s.name,
            fullTime: `${sc.startTime.substring(0, 5)} - ${sc.endTime.substring(0, 5)}`
          });
        }
      });
    });

    return HOURS.map(h => ({
      time: h,
      days: matrix[h]
    }));
  }, [subjects]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER / ACCIONES */}
      <div className="card !p-0 overflow-hidden border-none shadow-md">
        <div className="bg-brand-dark p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Mi Horario Académico</h2>
              <p className="text-brand-primary text-xs font-bold uppercase tracking-[0.3em] mt-1">Portal Estudiantil</p>
            </div>

            <button
              onClick={() => setShowSchedule(true)}
              className="btn btn-primary !py-3 !px-6 shadow-xl shadow-brand-primary/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              VER HORARIO COMPLETO
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="th">Asignatura</th>
              <th className="th">Código</th>
              <th className="th">Horarios Registrados</th>
              <th className="th text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key="s.id" className="tr-hover">
                <td className="td font-bold text-brand-dark">{s.name}</td>
                <td className="td font-mono text-xs">{s.code}</td>
                <td className="td">
                  <div className="flex flex-wrap gap-2">
                    {(s.schedules || []).map((sc, i) => (
                      <span key={i} className="badge">
                        {DAYS[sc.dayOfWeek]}: {sc.startTime.substring(0, 5)} - {sc.endTime.substring(0, 5)}
                      </span>
                    ))}
                    {(s.schedules || []).length === 0 && (
                      <span className="text-brand-gray/40 italic">Sin horarios asignados</span>
                    )}
                  </div>
                </td>
                <td className="td text-right">
                  <Link
                    to={`/app/student/subjects/${s.id}`}
                    className="btn btn-secondary !py-2 !px-4"
                  >
                    Ver Asistencias
                  </Link>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan="4" className="td text-center py-12 text-brand-gray/50 italic">
                  No estás matriculado en ninguna asignatura.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL HORARIO COMPLETO */}
      {showSchedule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm" onClick={() => setShowSchedule(false)}></div>
          <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="bg-brand-primary p-6 text-center shrink-0">
              <h3 className="text-white font-black uppercase tracking-widest">Cronograma Semanal</h3>
            </div>
            
            <div className="p-6 overflow-auto" ref={scheduleRef}>
              <div className="table-wrap border-none shadow-none bg-white p-4 rounded-xl">
                <table className="w-full border-separate border-spacing-y-2">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-black text-brand-gray uppercase tracking-widest bg-brand-light/50 rounded-l-xl">Hora</th>
                      {WORK_DAYS.map(d => (
                        <th key={d} className="px-4 py-3 text-[11px] font-black text-brand-gray uppercase tracking-widest bg-brand-light/50 last:rounded-r-xl text-center">{DAYS[d]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleData.map((row, i) => (
                      <tr key={i} className="group">
                        <td className="px-4 py-3 bg-brand-light/20 rounded-l-xl font-bold text-[10px] text-brand-gray text-center w-24">
                          {row.time}
                        </td>
                        {WORK_DAYS.map(d => (
                          <td key={d} className="px-2 py-1 bg-brand-light/5 min-w-[120px] last:rounded-r-xl">
                            {row.days[d].map((item, idx) => (
                              <div key={idx} className="bg-white border border-brand-primary/10 shadow-sm rounded-lg p-2 mb-1">
                                <p className="text-[10px] font-black text-brand-primary leading-tight uppercase truncate">{item.name}</p>
                                <p className="text-[9px] font-bold text-brand-gray mt-0.5">{item.fullTime}</p>
                              </div>
                            ))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-brand-light border-t border-brand-border flex flex-wrap justify-center gap-4 shrink-0">
              <button
                onClick={downloadSchedule}
                className="btn btn-secondary !px-12 flex items-center bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                DESCARGAR HORARIO
              </button>

              <button
                onClick={() => setShowSchedule(false)}
                className="btn btn-dark !px-12"
              >
                CERRAR VISTA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
