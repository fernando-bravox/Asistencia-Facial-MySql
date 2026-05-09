import React, { useEffect, useState, useMemo, useRef } from "react";
import { api } from "../../api/client.js";
import { Link } from "react-router-dom";
import { showAlert } from "../../utils/swalHelper.js";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Orden académico: lunes, martes, miércoles, jueves, viernes, sábado y domingo
const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0];

const HOURS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

function cleanText(value) {
  return String(value || "").trim();
}

function getStudentDisplayName(user) {
  const fullName = cleanText(
    user?.fullName || user?.fullname || user?.full_name
  );

  if (fullName) return fullName;

  const name = cleanText(user?.name);
  const lastname = cleanText(
    user?.lastname || user?.lastName || user?.last_name
  );

  const joined = `${name} ${lastname}`.trim();

  return joined || cleanText(user?.email) || "Estudiante";
}

function getStudentCode(user) {
  return cleanText(
    user?.studentCode ||
      user?.student_code ||
      user?.studentcode ||
      user?.code
  ) || "N/A";
}

function getScheduleStartHour(startTime) {
  const clean = String(startTime || "").trim();

  if (!clean || clean.length < 2) return null;

  return `${clean.substring(0, 2)}:00`;
}

function formatHour(value) {
  return String(value || "").substring(0, 5);
}

export default function StudentSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [user, setUser] = useState(null);
  const scheduleRef = useRef(null);

  async function load() {
    try {
      const data = await api("/api/student/subjects");
      setSubjects(data.subjects || []);

      const profile = await api("/api/auth/me");
      setUser(profile.user || null);
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  async function downloadSchedule() {
    const element = scheduleRef.current;
    if (!element) return;

    try {
      showAlert("info", "Procesando", "Generando documento...");

      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        showAlert(
          "warning",
          "Ventana bloqueada",
          "Permite las ventanas emergentes para descargar el horario."
        );
        return;
      }

      const styles = Array.from(
        document.querySelectorAll("style, link[rel='stylesheet']")
      )
        .map((style) => style.outerHTML)
        .join("");

      const content = element.innerHTML
        .replaceAll("min-w-[980px]", "")
        .replaceAll("border-separate", "border-collapse")
        .replaceAll("border-spacing-y-2", "");

      const studentName = getStudentDisplayName(user);
      const studentCode = getStudentCode(user);

      printWindow.document.write(`
        <html>
          <head>
            <title>Horario_${studentName}</title>
            ${styles}

            <style>
              @page {
                size: landscape;
                margin: 0.7cm;
              }

              * {
                box-sizing: border-box !important;
              }

              body {
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                font-family: Arial, sans-serif !important;
              }

              .print-container {
                width: 100% !important;
                max-width: 100% !important;
                overflow: hidden !important;
                padding: 12px !important;
                border: 2px solid #DC2626 !important;
                border-radius: 14px !important;
                margin: 0 !important;
              }

              .print-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                gap: 12px !important;
                margin-bottom: 14px !important;
                border-bottom: 2px solid #F1F5F9 !important;
                padding-bottom: 10px !important;
              }

              .print-title {
                margin: 0 !important;
                color: #DC2626 !important;
                font-size: 20px !important;
                font-weight: 900 !important;
              }

              .print-subtitle {
                margin: 4px 0 0 0 !important;
                color: #64748B !important;
                font-weight: bold !important;
                text-transform: uppercase !important;
                font-size: 8px !important;
                letter-spacing: 1.5px !important;
              }

              .print-student {
                text-align: right !important;
                max-width: 260px !important;
              }

              .print-student-name {
                margin: 0 !important;
                font-weight: 900 !important;
                color: #0F172A !important;
                font-size: 11px !important;
                word-break: break-word !important;
              }

              .print-student-code {
                margin: 2px 0 0 0 !important;
                color: #64748B !important;
                font-size: 10px !important;
              }

              .table-wrap {
                overflow: visible !important;
                max-height: none !important;
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }

              table {
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                table-layout: fixed !important;
                border-collapse: collapse !important;
                border-spacing: 0 !important;
                border: 1px solid #E2E8F0 !important;
              }

              th,
              td {
                border: 1px solid #E2E8F0 !important;
                padding: 4px !important;
                vertical-align: top !important;
                word-wrap: break-word !important;
                overflow-wrap: anywhere !important;
              }

              th {
                background: #F8FAFC !important;
                color: #334155 !important;
                font-size: 7px !important;
                text-transform: uppercase !important;
                text-align: center !important;
                font-weight: 900 !important;
              }

              td {
                font-size: 7px !important;
              }

              .sticky {
                position: static !important;
              }

              .schedule-hour {
                width: 45px !important;
                background: #F8FAFC !important;
                color: #64748B !important;
                text-align: center !important;
                font-weight: 900 !important;
                font-size: 7px !important;
              }

              .schedule-cell {
                min-height: 36px !important;
              }

              .schedule-item {
                max-width: 100% !important;
                overflow: hidden !important;
                border: 1px solid #FCA5A5 !important;
                border-radius: 6px !important;
                padding: 4px !important;
                margin-bottom: 3px !important;
                background: #FFFFFF !important;
                word-break: break-word !important;
              }

              .schedule-subject {
                color: #DC2626 !important;
                font-size: 6.5px !important;
                font-weight: 900 !important;
                text-transform: uppercase !important;
                line-height: 1.15 !important;
                margin: 0 !important;
                word-break: break-word !important;
                overflow-wrap: anywhere !important;
              }

              .schedule-code {
                color: #64748B !important;
                font-size: 6px !important;
                font-weight: 700 !important;
                margin: 2px 0 0 0 !important;
                word-break: break-word !important;
              }

              .schedule-time {
                color: #64748B !important;
                font-size: 6px !important;
                font-weight: 700 !important;
                margin: 2px 0 0 0 !important;
              }

              .print-footer {
                margin-top: 12px !important;
                text-align: center !important;
                color: #94A3B8 !important;
                font-size: 7px !important;
                font-style: italic !important;
              }
            </style>
          </head>

          <body>
            <div class="print-container">
              <div class="print-header">
                <div>
                  <h1 class="print-title">HORARIO ACADÉMICO</h1>
                  <p class="print-subtitle">
                    Portal Estudiantil - Sistema de Asistencia ASISPOCH
                  </p>
                </div>

                <div class="print-student">
                  <p class="print-student-name">${studentName}</p>
                  <p class="print-student-code">Código: ${studentCode}</p>
                </div>
              </div>

              ${content}

              <div class="print-footer">
                Generado el ${new Date().toLocaleString()} - Sistema de Asistencia ASISPOCH
              </div>
            </div>

            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 800);
              };
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();

      import("sweetalert2").then((Swal) => {
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

    HOURS.forEach((hour) => {
      matrix[hour] = {};

      DISPLAY_DAYS.forEach((day) => {
        matrix[hour][day] = [];
      });
    });

    (subjects || []).forEach((subject) => {
      (subject.schedules || []).forEach((schedule, index) => {
        const dayOfWeek = Number(schedule.dayOfWeek ?? schedule.day_of_week);
        const startTime = formatHour(schedule.startTime ?? schedule.start_time);
        const endTime = formatHour(schedule.endTime ?? schedule.end_time);
        const startHour = getScheduleStartHour(startTime);

        if (
          startHour &&
          matrix[startHour] &&
          Array.isArray(matrix[startHour][dayOfWeek])
        ) {
          matrix[startHour][dayOfWeek].push({
            id:
              schedule.id ||
              `${subject.id}-${dayOfWeek}-${startTime}-${endTime}-${index}`,
            name: subject.name || "Asignatura",
            code: subject.code || "",
            fullTime: `${startTime} - ${endTime}`,
          });
        }
      });
    });

    return HOURS.map((hour) => ({
      time: hour,
      days: matrix[hour],
    }));
  }, [subjects]);

  const studentName = getStudentDisplayName(user);
  const studentCode = getStudentCode(user);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER / ACCIONES */}
      <div className="card !p-0 overflow-hidden border-none shadow-md">
        <div className="bg-brand-dark p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">
                Mi Horario Académico
              </h2>

              <p className="text-brand-primary text-xs font-bold uppercase tracking-[0.3em] mt-1">
                Portal Estudiantil
              </p>

              <div className="mt-3 text-sm text-white/80">
                <span className="font-bold">{studentName}</span>
                <span className="mx-2">•</span>
                <span>Código: {studentCode}</span>
              </div>
            </div>

            <button
              onClick={() => setShowSchedule(true)}
              className="btn btn-primary !py-3 !px-6 shadow-xl shadow-brand-primary/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
              VER HORARIO COMPLETO
            </button>
          </div>
        </div>
      </div>

      {/* LISTA DE MATERIAS */}
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
            {(subjects || []).map((subject) => (
              <tr key={subject.id} className="tr-hover">
                <td className="td font-bold text-brand-dark">
                  {subject.name || "Sin nombre"}
                </td>

                <td className="td font-mono text-xs">
                  {subject.code || "-"}
                </td>

                <td className="td">
                  <div className="flex flex-wrap gap-2">
                    {(subject.schedules || []).map((schedule, index) => {
                      const day = Number(
                        schedule.dayOfWeek ?? schedule.day_of_week
                      );

                      const start = formatHour(
                        schedule.startTime ?? schedule.start_time
                      );

                      const end = formatHour(
                        schedule.endTime ?? schedule.end_time
                      );

                      return (
                        <span
                          key={
                            schedule.id ||
                            `${subject.id}-${day}-${start}-${end}-${index}`
                          }
                          className="badge"
                        >
                          {DAYS[day] || "Día"}: {start} - {end}
                        </span>
                      );
                    })}

                    {(subject.schedules || []).length === 0 && (
                      <span className="text-brand-gray/40 italic">
                        Sin horarios asignados
                      </span>
                    )}
                  </div>
                </td>

                <td className="td text-right">
                  <Link
                    to={`/app/student/subjects/${subject.id}`}
                    className="btn btn-secondary !py-2 !px-4"
                  >
                    Ver Asistencias
                  </Link>
                </td>
              </tr>
            ))}

            {(subjects || []).length === 0 && (
              <tr>
                <td
                  colSpan="4"
                  className="td text-center py-12 text-brand-gray/50 italic"
                >
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
          <div
            className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm"
            onClick={() => setShowSchedule(false)}
          ></div>

          <div className="relative w-full max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="bg-brand-primary p-6 text-center shrink-0">
              <h3 className="text-white font-black uppercase tracking-widest">
                Cronograma Semanal
              </h3>

              <p className="text-white/80 text-xs mt-1 font-semibold">
                Lunes a domingo
              </p>
            </div>

            <div className="p-4 sm:p-6 overflow-auto" ref={scheduleRef}>
              <div className="bg-white p-2 sm:p-4 rounded-xl">
                <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-y-2">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr>
                      <th className="w-[80px] px-2 py-3 text-[10px] font-black text-brand-gray uppercase tracking-widest bg-brand-light/50 rounded-l-xl text-center">
                        Hora
                      </th>

                      {DISPLAY_DAYS.map((day) => (
                        <th
                          key={day}
                          className="px-2 py-3 text-[10px] font-black text-brand-gray uppercase tracking-widest bg-brand-light/50 last:rounded-r-xl text-center"
                        >
                          {DAYS[day]}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {scheduleData.map((row) => (
                      <tr key={row.time} className="group">
                        <td className="px-2 py-3 bg-brand-light/20 rounded-l-xl font-bold text-[10px] text-brand-gray text-center align-top">
                          {row.time}
                        </td>

                        {DISPLAY_DAYS.map((day) => (
                          <td
                            key={`${row.time}-${day}`}
                            className="px-1.5 py-1 bg-brand-light/5 last:rounded-r-xl align-top"
                          >
                            <div className="min-h-[48px] space-y-1">
                              {(row.days[day] || []).map((item, index) => (
                                <div
                                  key={item.id || `${row.time}-${day}-${index}`}
                                  className="schedule-item bg-white border border-brand-primary/10 shadow-sm rounded-lg p-2 overflow-hidden"
                                >
                                  <p className="schedule-subject text-[10px] font-black text-brand-primary leading-tight uppercase whitespace-normal break-words">
                                    {item.name}
                                  </p>

                                  {item.code && (
                                    <p className="schedule-code text-[8px] font-bold text-brand-gray/70 mt-0.5 whitespace-normal break-words">
                                      {item.code}
                                    </p>
                                  )}

                                  <p className="schedule-time text-[9px] font-bold text-brand-gray mt-0.5 whitespace-normal break-words">
                                    {item.fullTime}
                                  </p>
                                </div>
                              ))}
                            </div>
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
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