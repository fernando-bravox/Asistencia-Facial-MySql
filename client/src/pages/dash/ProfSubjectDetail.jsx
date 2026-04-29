import FaceAttendanceScanner from "../../components/FaceAttendanceScanner.jsx";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, getToken } from "../../api/client.js";
import { 
  FaCalendarAlt, 
  FaUserGraduate, 
  FaCog, 
  FaClipboardList, 
  FaArrowLeft,
  FaCamera,
  FaFileExcel,
  FaFilter,
  FaTrash,
  FaCheck,
  FaTimes,
  FaEdit,
  FaChartLine,
  FaImages
} from "react-icons/fa";

import { showAlert } from "../../utils/swalHelper.js";
import Swal from "sweetalert2";
import TapoAttendanceScanner from "../../components/TapoAttendanceScanner.jsx";


const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function ProfSubjectDetail() {
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState("attendance"); // "attendance", "schedule", "enrollment", "settings", "stats"
  const [filterDate, setFilterDate] = useState("");
  const [filterScheduleId, setFilterScheduleId] = useState("all"); // "all" o id de schedule

  const [subjects, setSubjects] = useState([]);
  const subject = useMemo(() => subjects.find(s => s.id === id), [subjects, id]);

  const [schedules, setSchedules] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState({ graceMinutes: 10 });
const [showStats, setShowStats] = useState(false);
const [from, setFrom] = useState("");
const [to, setTo] = useState("");
const [stats, setStats] = useState([]);

  // ✅ NUEVO: lista real de estudiantes desde Firestore
  const [allStudents, setAllStudents] = useState([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const [schedForm, setSchedForm] = useState({ dayOfWeek: 1, startTime: "13:00", endTime: "15:00" });
  const [manualForm, setManualForm] = useState({ studentId: "", status: "present" });

  // ✅ abrir/cerrar escáner
  const [scanOpen, setScanOpen] = useState(false);
  const [tapoOpen, setTapoOpen] = useState(false);


  // ✅ modal editar timestamp
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editTimestamp, setEditTimestamp] = useState("");

  // ✅ Evidencias Tapo
  const [evidenceShots, setEvidenceShots] = useState([]);
  const [evidenceVisible, setEvidenceVisible] = useState(3);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // =========================
  // LOAD ALL
  // =========================
  async function loadAll() {
    try {
      const s1 = await api("/api/prof/subjects");
      setSubjects(s1.subjects || []);

      const s2 = await api(`/api/prof/subjects/${id}/schedules`);
      setSchedules(s2.schedules || []);

      const s3 = await api(`/api/prof/subjects/${id}/enrollments`);
      setEnrollments(s3.enrollments || []);

      const s4 = await api(`/api/prof/subjects/${id}/attendance`);
      setAttendance(s4.attendance || []);

      const s5 = await api(`/api/prof/subjects/${id}/settings`);
      setSettings(s5.settings || { graceMinutes: 10 });

      const s6 = await api("/api/prof/students");
      setAllStudents(s6.students || []);
    } catch (err) {
      showAlert("error", "Error cargando datos", err.message);
    }
  }

  useEffect(() => {
    loadAll();
    setScanOpen(false);
    setTapoOpen(false);

    setStudentQuery("");
    setSelectedStudentId("");
    setEvidenceShots([]);
    setEvidenceVisible(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (activeTab === "evidence") {
      loadEvidenceShots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  // =========================
  // Horarios
  // =========================
  async function addSchedule(e) {
    e.preventDefault();
    try {
      await api(`/api/prof/subjects/${id}/schedules`, { method: "POST", body: schedForm });
      await loadAll();
      showAlert("success", "Éxito", "Horario agregado correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }
  function labelEstado(status) {
  if (status === "late") return "Tarde";
  if (status === "present") return "Presente";
  return status; // por si llega otro valor
}

function buildRange() {
  if (!filterDate) return { from: null, to: null };

  // si es "todo el día"
  if (filterScheduleId === "all") {
    const from = new Date(`${filterDate}T00:00:00`);
    const to = new Date(`${filterDate}T23:59:59`);
    return { from, to };
  }

  const sc = schedules.find(s => s.id === filterScheduleId);
  if (!sc) return { from: null, to: null };

  const from = new Date(`${filterDate}T${sc.startTime}:00`);
  const to = new Date(`${filterDate}T${sc.endTime}:59`);
  return { from, to };
}

const filteredAttendance = useMemo(() => {
  const { from, to } = buildRange();
  if (!from || !to) return attendance;

  return (attendance || []).filter(a => {
    const t = new Date(a.timestamp);
    return t >= from && t <= to;
  });
}, [attendance, filterDate, filterScheduleId, schedules]);

  async function deleteSchedule(scheduleId) {
    const result = await Swal.fire({
      title: "¿Eliminar horario?",
      text: "Se eliminará el horario de clase.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      await api(`/api/prof/subjects/${id}/schedules/${scheduleId}`, { method: "DELETE" });
      await loadAll();
      showAlert("success", "Eliminado", "Horario eliminado correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  // =========================
  // Settings
  // =========================
  async function saveSettings(e) {
    e.preventDefault();
    try {
      await api(`/api/prof/subjects/${id}/settings`, {
        method: "PUT",
        body: { graceMinutes: Number(settings.graceMinutes) }
      });
      await loadAll();
      showAlert("success", "Éxito", "Configuración guardada correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  // =========================
  // Matrícula: por studentId (desde selector)
  // =========================
  const enrolledIds = useMemo(() => new Set((enrollments || []).map(e => e.studentId)), [enrollments]);

  const filteredStudents = useMemo(() => {
    const q = String(studentQuery || "").trim().toLowerCase();

    let pool = (allStudents || []).filter(s => !enrolledIds.has(s.id));
    if (!q) return pool.slice(0, 15);

    pool = pool.filter(s => {
      const name = String(s.name || "").toLowerCase();
      const email = String(s.email || "").toLowerCase();
      const code = String(s.studentCode || "").toLowerCase();
      return name.includes(q) || email.includes(q) || code.includes(q);
    });

    return pool.slice(0, 15);
  }, [allStudents, studentQuery, enrolledIds]);

  const selectedStudent = useMemo(() => {
    return (allStudents || []).find(s => s.id === selectedStudentId) || null;
  }, [allStudents, selectedStudentId]);

  async function addEnrollment(e) {
    e.preventDefault();

    if (!selectedStudentId) {
      return showAlert("warning", "Atención", "Selecciona un estudiante primero.");
    }

    try {
      await api(`/api/prof/subjects/${id}/enrollments`, {
        method: "POST",
        body: { studentId: selectedStudentId }
      });

      setSelectedStudentId("");
      setStudentQuery("");
      await loadAll();
      showAlert("success", "Éxito", "Estudiante matriculado correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  async function removeEnrollment(enrollmentId) {
    const result = await Swal.fire({
      title: "¿Quitar matrícula?",
      text: "El estudiante ya no aparecerá en la lista de esta materia.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      await api(`/api/prof/subjects/${id}/enrollments/${enrollmentId}`, { method: "DELETE" });
      await loadAll();
      showAlert("success", "Eliminado", "Matrícula eliminada correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }


  // =========================
  // Asistencia: manual
  // =========================
  async function manualMark(e) {
    e.preventDefault();
    if (!manualForm.studentId) return showAlert("warning", "Atención", "Selecciona un estudiante.");
    try {
      await api(`/api/prof/subjects/${id}/attendance/manual`, { method: "POST", body: manualForm });
      await loadAll();
      showAlert("success", "Éxito", "Asistencia registrada manualmente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  // =========================
  // Asistencia: aprobar/rechazar
  // =========================
  async function approve(attendanceId) {
    try {
      await api(`/api/prof/subjects/${id}/attendance/${attendanceId}/approve`, { method: "POST" });
      showAlert("success", "Éxito", "Asistencia aprobada");
      await loadAll();
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  async function reject(attendanceId) {
    try {
      await api(`/api/prof/subjects/${id}/attendance/${attendanceId}/reject`, { method: "POST" });
      showAlert("success", "Éxito", "Asistencia rechazada");
      await loadAll();
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getApiOrigin() {
  try {
    if (API_BASE_URL.startsWith("http")) {
      return new URL(API_BASE_URL).origin;
    }

    return "";
  } catch {
    return "";
  }
}

function getEvidenceImageSrc(img) {
  const rawUrl = img.imageUrl || img.viewUrl || "";

  if (!rawUrl) return "";

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  return `${getApiOrigin()}${rawUrl}`;
}


  // =========================
  // Asistencia: borrar
  // =========================
  async function deleteAttendance(attendanceId) {
    const result = await Swal.fire({
      title: "¿Eliminar este registro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      await api(`/api/prof/subjects/${id}/attendance/${attendanceId}`, { method: "DELETE" });
      await loadAll();
      showAlert("success", "Eliminado", "Registro de asistencia eliminado correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  // =========================
  // Asistencia: editar timestamp
  // =========================
  function openEdit(att) {
    setEditItem(att);

    const d = new Date(att.timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    setEditTimestamp(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);

    setEditOpen(true);
  }

  async function saveEditTimestamp(e) {
    e.preventDefault();
    if (!editItem) return;

    try {
      const newDate = new Date(editTimestamp);
      await api(`/api/prof/subjects/${id}/attendance/${editItem.id}/timestamp`, {
        method: "PUT",
        body: { timestamp: newDate.toISOString() }
      });

      setEditOpen(false);
      setEditItem(null);
      setEditTimestamp("");
      await loadAll();
      showAlert("success", "Éxito", "Hora actualizada correctamente.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }
async function loadStats() {
  if (!from || !to) {
    alert("Selecciona fecha inicio y fin");
    return;
  }

  const data = await api(
    `/api/prof/subjects/${id}/attendance/stats?from=${from}&to=${to}`
  );
  setStats(data);
}


  // =========================
  // Evidencias Tapo
  // =========================
  function labelEvidenceShot(shotType) {
    if (shotType === "EARLY_5") return "Inicio de clase";
    if (shotType === "GRACE_END") return "Límite / gracia";
    if (shotType === "MID_30") return "Seguimiento de clase";
    return shotType || "Evidencia";
  }

  function formatEvidenceDateTime(value) {
    if (!value) return { date: "-", hour: "-" };

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return { date: "-", hour: "-" };

    return {
      date: d.toLocaleDateString("es-EC", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }),
      hour: d.toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };
  }

    async function loadEvidenceShots() {
      try {
        setEvidenceLoading(true);

        const data = await api(`/api/prof/subjects/${encodeURIComponent(id)}/evidence-all`);

        console.log("📸 Evidencias recibidas:", data);

        setEvidenceShots(data.evidence || []);
        setEvidenceVisible(3);
      } catch (err) {
        console.error("❌ Error cargando evidencias:", err);
        showAlert("error", "Error cargando evidencias", err.message || "No se pudieron cargar las evidencias");
        setEvidenceShots([]);
      } finally {
        setEvidenceLoading(false);
      }
    }


  // =========================
  // Export Excel
  // =========================
  async function exportExcel() {
  try {
    const { from, to } = buildRange();
    const qs = new URLSearchParams();

    if (from && to) {
      qs.set("from", from.toISOString());
      qs.set("to", to.toISOString());
    }

    const url = `/api/prof/subjects/${id}/attendance/export${qs.toString() ? `?${qs}` : ""}`;

    const token = getToken();

    const r = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      // si tu backend además usa cookie, lo dejas:
      credentials: "include"
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || "No se pudo exportar");
    }

    const blob = await r.blob();
    const dl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = dl;
    a.download = `asistencia_${id}${filterDate ? "_" + filterDate : ""}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(dl);
  } catch (err) {
    showAlert("error", "Error", err.message);
  }
}



  const studentsForSelect = enrollments.map(e => e.student).filter(Boolean);
  const enrolledStudentsForScan = studentsForSelect;

  // Estadísticas rápidas
  const today = new Date().toISOString().split("T")[0];
  const attendanceTodayCount = useMemo(() => {
    return (attendance || []).filter(a => a.timestamp.startsWith(today)).length;
  }, [attendance, today]);

  return (
    <div className="space-y-6">
      {/* ✅ Header materia */}
      <div className="card glass-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link className="btn secondary p-3 rounded-full" to="/app/prof/subjects" title="Volver">
              <FaArrowLeft />
            </Link>
            <div className="min-w-0">
              <h2 className="h2 mb-0">
                {subject ? `${subject.name} (${subject.code})` : "Cargando materia..."}
              </h2>
              <div className="muted mt-0.5 flex items-center gap-2">
                <span className="badge">Aula: {subject?.room || "-"}</span>
                <span className="badge secondary">{enrollments.length} Estudiantes</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold uppercase text-muted">Asistencias Hoy</div>
              <div className="text-2xl font-black text-red-600">{attendanceTodayCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Menú de Navegación (Tabs) */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        {[
          { id: "attendance", label: "Asistencias", icon: FaClipboardList },
          { id: "schedule", label: "Horarios", icon: FaCalendarAlt },
          { id: "enrollment", label: "Estudiantes", icon: FaUserGraduate },
          { id: "evidence", label: "Evidencias", icon: FaImages },
          { id: "stats", label: "Estadísticas", icon: FaChartLine },
          { id: "settings", label: "Configuración", icon: FaCog },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === tab.id
                ? "border-red-600 text-red-600 bg-red-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            } rounded-t-lg`}
          >
            <tab.icon className={activeTab === tab.id ? "text-red-600" : "text-gray-400"} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ✅ Contenido por Tab */}
      <div className="tab-content animate-in fade-in duration-300">
        
        {/* ======================================================
            TAB: ASISTENCIAS
           ====================================================== */}
        {activeTab === "attendance" && (
          <div className="space-y-6">
            
            {/* ✅ Escáner y Filtros */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Columna Izquierda: Escáner y Manual */}
              <div className="xl:col-span-1 space-y-6">
                
                {/* Escáner Card */}
                <div className="card glass-card border-l-4 border-red-600">
                  <h3 className="title flex items-center gap-2">
                    <FaCamera className="text-red-600" />
                    Registro Biométrico
                  </h3>
                  <p className="muted text-sm mt-1">
                    Activa la cámara para marcar asistencia automáticamente mediante reconocimiento facial.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      className={`btn ${tapoOpen ? "danger" : "secondary"}`}
                      onClick={() => {
                        setTapoOpen(v => !v);
                        setScanOpen(false);
                      }}
                    >
                      {tapoOpen ? "Cerrar TP-LINK" : "Cámara TP-LINK (IP)"}
                    </button>

                    <button
                      type="button"
                      className={`btn ${scanOpen ? "danger" : ""}`}
                      onClick={() => {
                        setScanOpen(v => !v);
                        setTapoOpen(false);
                      }}
                    >
                      {scanOpen ? "Cerrar Cámara" : "Cámara Dispositivo"}
                    </button>
                  </div>

                  {scanOpen && (
                    <div className="mt-4 overflow-hidden rounded-xl border-2 border-red-100">
                      <FaceAttendanceScanner
                        subjectId={id}
                        enrolledStudents={enrolledStudentsForScan}
                        onMarked={async () => {
                          await loadAll();
                          showAlert("success", "¡Éxito!", "Asistencia registrada correctamente.");
                        }}
                      />
                    </div>
                  )}
                  {tapoOpen && (
                    <div className="mt-4 overflow-hidden rounded-xl border-2 border-red-100">
                      <TapoAttendanceScanner
                        subjectId={id}
                        enrolledStudents={enrolledStudentsForScan}
                        onMarked={async () => {
                          await loadAll();
                          await loadEvidenceShots();
                          showAlert("success", "¡Éxito!", "Asistencia procesada (Tapo).");
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Registro Manual Card */}
                <div className="card glass-card">
                  <h3 className="title text-sm">Registro Manual</h3>
                  <form onSubmit={manualMark} className="mt-3 space-y-3">
                    <div>
                      <label className="label">Estudiante</label>
                      <select
                        className="input"
                        value={manualForm.studentId}
                        onChange={e => setManualForm({ ...manualForm, studentId: e.target.value })}
                      >
                        <option value="">-- Seleccionar --</option>
                        {studentsForSelect.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Estado</label>
                      <select
                        className="input"
                        value={manualForm.status}
                        onChange={e => setManualForm({ ...manualForm, status: e.target.value })}
                      >
                        <option value="present">Presente</option>
                        <option value="late">Tarde</option>
                      </select>
                    </div>

                    <button className="btn w-full" type="submit">
                      Guardar Manual
                    </button>
                  </form>
                </div>
              </div>

              {/* Columna Derecha: Listado y Filtros */}
              <div className="xl:col-span-2 space-y-4">
                
                {/* Barra de Filtros */}
                <div className="card glass-card py-3 px-4">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 min-w-[150px]">
                      <label className="label flex items-center gap-1">
                        <FaFilter className="text-xs" /> Filtrar por fecha
                      </label>
                      <input
                        className="input py-1.5"
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                      />
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <label className="label">Horario</label>
                      <select
                        className="input py-1.5"
                        value={filterScheduleId}
                        onChange={(e) => setFilterScheduleId(e.target.value)}
                        disabled={!filterDate}
                      >
                        <option value="all">Todo el día</option>
                        {schedules.map(sc => (
                          <option key={sc.id} value={sc.id}>
                            {DAYS[Number(sc.dayOfWeek)]} {sc.startTime} - {sc.endTime}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn secondary py-2 px-3"
                        onClick={() => { setFilterDate(""); setFilterScheduleId("all"); }}
                        title="Limpiar"
                      >
                        <FaTrash />
                      </button>
                      <button className="btn flex items-center gap-2 py-2 px-4" type="button" onClick={exportExcel}>
                        <FaFileExcel /> Exportar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabla de Asistencia */}
                <div className="card glass-card p-0 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="title text-sm mb-0 uppercase tracking-wider">Registros de Asistencia</h3>
                    <div className="badge">
                      Total: {filteredAttendance.length}
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="table w-full">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th>Estudiante</th>
                          <th>Fecha/Hora</th>
                          <th>Estado</th>
                          <th className="hidden sm:table-cell">Método</th>
                          <th className="text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(enrollments || []).map((e) => {
                          const student = (allStudents || []).find(s => s.id === e.studentId);
                          const a = (filteredAttendance || []).find(x => 
                            (x.studentId === e.studentId) || (x.student?.id === e.studentId)
                          );

                          const status = a?.status ?? "absent";
                          const timestamp = a?.timestamp ?? null;
                          const method = a?.method ?? "-";

                          return (
                            <tr key={a?.id || `absent-${e.studentId}`}>
                              <td>
                                <div className="font-bold">{a?.student?.name || student?.name || "N/A"}</div>
                                <div className="text-[10px] muted uppercase">{student?.studentCode || "-"}</div>
                              </td>

                              <td className="muted text-xs">
                                {timestamp ? new Date(timestamp).toLocaleString() : "-"}
                              </td>

                              <td>
                                <span className={`badge ${
                                  status === "present" ? "ok" : status === "late" ? "warn" : "danger"
                                }`}>
                                  {status === "present" ? "Presente" : status === "late" ? "Tarde" : "Falta"}
                                </span>
                              </td>

                              <td className="muted text-xs hidden sm:table-cell">
                                {method === "prof_device" ? "Sistema" : method === "manual" ? "Manual" : method}
                              </td>

                              <td className="text-right">
                                {a ? (
                                  <div className="flex justify-end gap-1">
                                    <button className="btn secondary p-2 rounded-lg" title="Editar" onClick={() => openEdit(a)}>
                                      <FaEdit />
                                    </button>
                                    <button className="btn danger p-2 rounded-lg" title="Eliminar" onClick={() => deleteAttendance(a.id)}>
                                      <FaTrash />
                                    </button>
                                    {a.approvalStatus === "pending" && (
                                      <>
                                        <button className="btn p-2 rounded-lg" title="Aprobar" onClick={() => approve(a.id)}>
                                          <FaCheck />
                                        </button>
                                        <button className="btn danger p-2 rounded-lg" title="Rechazar" onClick={() => reject(a.id)}>
                                          <FaTimes />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-red-400 uppercase">Sin Registro</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            TAB: EVIDENCIAS TAPO
           ====================================================== */}
        {activeTab === "evidence" && (
          <div className="space-y-6">
            <div className="card glass-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="title flex items-center gap-2 mb-1">
                    <FaImages className="text-red-600" />
                    Evidencias de clases
                  </h3>
                  <p className="muted text-sm">
                    Imágenes tomadas por la cámara Tapo, ordenadas desde la más reciente.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="badge">Total: {evidenceShots.length}</span>
                  <button
                    type="button"
                    className="btn secondary py-2 px-4"
                    onClick={loadEvidenceShots}
                    disabled={evidenceLoading}
                  >
                    {evidenceLoading ? "Cargando..." : "Actualizar"}
                  </button>
                </div>
              </div>

              {evidenceLoading && evidenceShots.length === 0 ? (
                <div className="py-14 text-center muted font-bold">
                  Cargando evidencias...
                </div>
              ) : evidenceShots.length === 0 ? (
                <div className="py-14 text-center">
                  <FaCamera className="mx-auto text-4xl text-gray-300 mb-3" />
                  <div className="font-black text-gray-700">No hay imágenes registradas</div>
                  <div className="muted text-sm mt-1">
                    Cuando la cámara Tapo tome evidencias, aparecerán aquí.
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-5">
                    {evidenceShots.slice(0, evidenceVisible).map((img) => {
                      const taken = formatEvidenceDateTime(img.takenAt || img.createdAt);
                      const created = formatEvidenceDateTime(img.createdAt);
                      const expires = formatEvidenceDateTime(img.expiresAt);

                      return (
                        <div
                          key={img.id || img.fileName}
                          className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                            <img
                              src={getEvidenceImageSrc(img)}
                              alt={img.fileName || "Evidencia Tapo"}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                console.error("❌ No cargó imagen:", img.imageUrl || img.viewUrl);
                                e.currentTarget.style.display = "none";
                              }}
                            />

                            <div className="absolute top-3 left-3">
                              <span className="badge bg-white/95 text-red-600 shadow-sm">
                                {labelEvidenceShot(img.shotType)}
                              </span>
                            </div>

                            <div className="absolute bottom-3 right-3">
                              <span className={`badge ${img.expired ? "danger" : "ok"}`}>
                                {img.expired ? "Expirada" : "Vigente"}
                              </span>
                            </div>
                          </div>

                          <div className="p-4 space-y-4">
                            <div>
                              <div className="font-black text-gray-800 leading-tight">
                                {labelEvidenceShot(img.shotType)}
                              </div>
                              <div className="muted text-[11px] break-all mt-1">
                                {img.fileName || "Sin nombre de archivo"}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <div className="text-[10px] font-black uppercase text-gray-400">Tomada</div>
                                <div className="text-sm font-black text-gray-800 capitalize">{taken.date}</div>
                                <div className="text-xs muted mt-0.5">{taken.hour}</div>
                              </div>

                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <div className="text-[10px] font-black uppercase text-gray-400">Expira</div>
                                <div className="text-sm font-black text-gray-800 capitalize">{expires.date}</div>
                                <div className="text-xs muted mt-0.5">{expires.hour}</div>
                              </div>
                            </div>

                            <div className="rounded-xl border border-gray-100 p-3 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-black uppercase text-gray-400">Creada en base</div>
                                <div className="text-xs font-bold text-gray-700 capitalize">{created.date}</div>
                              </div>
                              <div className="text-xs font-black text-red-600 whitespace-nowrap">
                                {created.hour}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5">
                    <div className="muted text-sm">
                      Mostrando {Math.min(evidenceVisible, evidenceShots.length)} de {evidenceShots.length} evidencias
                    </div>

                    {evidenceVisible < evidenceShots.length && (
                      <button
                        type="button"
                        className="btn px-8"
                        onClick={() => setEvidenceVisible(v => v + 3)}
                      >
                        Ver más
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}


        {/* ======================================================
            TAB: HORARIOS
           ====================================================== */}
        {activeTab === "schedule" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="card glass-card">
                <h3 className="title">Nuevo Horario</h3>
                <form onSubmit={addSchedule} className="mt-4 space-y-4">
                  <div>
                    <label className="label">Día de la semana</label>
                    <select
                      className="input"
                      value={schedForm.dayOfWeek}
                      onChange={(e) => setSchedForm({ ...schedForm, dayOfWeek: Number(e.target.value) })}
                    >
                      {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Hora Inicio</label>
                      <input
                        className="input"
                        type="time"
                        value={schedForm.startTime}
                        onChange={(e) => {
                          const start = e.target.value;
                          if (!start) return;
                          
                          // Calculamos una hora después para el fin por defecto
                          const [h, m] = start.split(":").map(Number);
                          let endH = h + 1;
                          if (endH >= 24) endH = 23; // tope máximo
                          const end = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                          
                          setSchedForm({ ...schedForm, startTime: start, endTime: end });
                        }}
                      />
                    </div>
                    <div>
                      <label className="label">Hora Fin</label>
                      <input
                        className="input"
                        type="time"
                        value={schedForm.endTime}
                        min={schedForm.startTime}
                        onChange={(e) => setSchedForm({...schedForm, endTime: e.target.value})}
                      />
                    </div>
                  </div>
                  <button className="btn w-full mt-2" type="submit">
                    <FaCalendarAlt /> Agregar Horario
                  </button>
                </form>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="card glass-card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="title text-sm mb-0 uppercase tracking-wider">Horarios de Clase</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Día</th>
                        <th>Rango Horario</th>
                        <th className="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map(sc => (
                        <tr key={sc.id}>
                          <td className="font-bold">{DAYS[Number(sc.dayOfWeek)]}</td>
                          <td className="muted">{sc.startTime} - {sc.endTime}</td>
                          <td className="text-right">
                            <button className="btn danger p-2 rounded-lg" onClick={() => deleteSchedule(sc.id)}>
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {schedules.length === 0 && (
                        <tr><td colSpan="3" className="text-center py-10 muted">No hay horarios definidos</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            TAB: ESTUDIANTES (Matrícula)
           ====================================================== */}
        {activeTab === "enrollment" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="card glass-card">
                <h3 className="title">Matricular Estudiante</h3>
                <form onSubmit={addEnrollment} className="mt-4 space-y-4">
                  <div>
                    <label className="label">Buscar Estudiante</label>
                    <input
                      className="input"
                      value={studentQuery}
                      onChange={e => { setStudentQuery(e.target.value); setSelectedStudentId(""); }}
                      placeholder="Nombre, email o código..."
                    />
                  </div>

                  <div className="rounded-xl border border-gray-100 p-1 max-h-[300px] overflow-auto space-y-1 bg-gray-50/30">
                    {filteredStudents.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className={`w-full text-left p-2 rounded-lg text-sm transition-all ${
                          selectedStudentId === s.id 
                            ? "bg-red-600 text-white shadow-md" 
                            : "hover:bg-white hover:shadow-sm text-gray-700"
                        }`}
                        onClick={() => setSelectedStudentId(s.id)}
                      >
                        <div className="font-bold">{s.name}</div>
                        <div className={`text-xs ${selectedStudentId === s.id ? "text-red-100" : "muted"}`}>
                          {s.studentCode} • {s.email}
                        </div>
                      </button>
                    ))}
                    {filteredStudents.length === 0 && <div className="p-4 text-center muted text-xs">No hay estudiantes disponibles</div>}
                  </div>

                  <button className="btn w-full" type="submit" disabled={!selectedStudentId}>
                    <FaUserGraduate /> Matricular Estudiante
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="card glass-card p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="title text-sm mb-0 uppercase tracking-wider">Estudiantes Matriculados</h3>
                  <div className="badge">{enrollments.length} Total</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        <th className="hidden md:table-cell">Email</th>
                        <th className="text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map(e => (
                        <tr key={e.id}>
                          <td>
                            <div className="font-bold">{e.student?.name || "N/A"}</div>
                            <div className="text-[10px] muted uppercase">{e.student?.studentCode || "-"}</div>
                          </td>
                          <td className="muted text-sm hidden md:table-cell">{e.student?.email || "N/A"}</td>
                          <td className="text-right">
                            <button className="btn danger p-2 rounded-lg" onClick={() => removeEnrollment(e.id)}>
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {enrollments.length === 0 && (
                        <tr><td colSpan="3" className="text-center py-10 muted">No hay estudiantes matriculados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================
            TAB: ESTADÍSTICAS
           ====================================================== */}
        {activeTab === "stats" && (
          <div className="card glass-card">
            <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
              <div className="flex-1">
                <label className="label">Desde</label>
                <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="label">Hasta</label>
                <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
              <button className="btn" onClick={loadStats}>
                Generar Informe
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th className="text-center">Clases Programadas</th>
                    <th className="text-center">Asistencias</th>
                    <th className="text-center">Rendimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(s => (
                    <tr key={s.studentId}>
                      <td className="font-bold">{s.name}</td>
                      <td className="text-center muted">{s.total}</td>
                      <td className="text-center font-bold text-green-600">{s.attended}</td>
                      <td className="text-center">
                        <div className="flex items-center gap-3 justify-center">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[100px] overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${s.percent > 75 ? 'bg-green-500' : s.percent > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${s.percent}%` }}
                            ></div>
                          </div>
                          <span className="font-black text-sm">{s.percent}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {stats.length === 0 && (
                    <tr><td colSpan="4" className="text-center py-10 muted">Selecciona un rango de fechas para ver el informe</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================
            TAB: CONFIGURACIÓN
           ====================================================== */}
        {activeTab === "settings" && (
          <div className="max-w-2xl mx-auto">
            <div className="card glass-card">
              <h3 className="title">Configuración de Clase</h3>
              <p className="muted text-sm mt-1">
                Ajustes generales para el control de asistencia de esta materia.
              </p>

              <form onSubmit={saveSettings} className="mt-6 space-y-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <label className="label text-gray-700">Tiempo de Gracia (Minutos)</label>
                  <p className="text-xs text-gray-500 mb-3">
                    Define cuántos minutos después del inicio de la clase un estudiante puede marcar "Presente". Pasado este tiempo, se marcará como "Tarde".
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      className="input max-w-[120px]"
                      type="number"
                      value={settings.graceMinutes ?? 10}
                      onChange={e => setSettings({ ...settings, graceMinutes: e.target.value })}
                    />
                    <span className="font-bold text-gray-400">minutos</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="btn px-10" type="submit">
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Modal editar Timestamp (Común) */}
      {editOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card glass-card w-full max-w-md animate-in zoom-in-95 duration-200">
            <h3 className="title">Ajustar Registro</h3>
            <div className="muted mt-1 text-sm">
              Cambiando registro de: <b className="text-gray-700">{editItem?.student?.name}</b>
            </div>

            <form onSubmit={saveEditTimestamp} className="mt-6 space-y-4">
              <div>
                <label className="label">Nueva Fecha y Hora</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={editTimestamp}
                  onChange={e => setEditTimestamp(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  className="btn secondary flex-1"
                  type="button"
                  onClick={() => { setEditOpen(false); setEditItem(null); }}
                >
                  Cancelar
                </button>
                <button className="btn flex-1" type="submit">
                  Confirmar Cambio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
