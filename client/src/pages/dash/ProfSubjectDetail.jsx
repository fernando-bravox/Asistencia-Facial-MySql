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
  FaImage
} from "react-icons/fa";

import { showAlert } from "../../utils/swalHelper.js";
import Swal from "sweetalert2";
import TapoAttendanceScanner from "../../components/TapoAttendanceScanner.jsx";


const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function todayLocalDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayFromDate(dateStr) {
  if (!dateStr) return null;

  const [y, m, d] = String(dateStr).split("-").map(Number);

  if (!y || !m || !d) return null;

  return new Date(y, m - 1, d).getDay();
}

function scheduleDow(sc) {
  return Number(sc?.dayOfWeek ?? sc?.day_of_week);
}

function scheduleStart(sc) {
  return sc?.startTime ?? sc?.start_time ?? "";
}

function scheduleEnd(sc) {
  return sc?.endTime ?? sc?.end_time ?? "";
}

function minutesFromHHMM(value) {
  const [h, m] = String(value || "00:00").slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function currentHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function isTimeInsideSchedule(time, sc) {
  if (!time || !sc) return false;

  const value = minutesFromHHMM(time);
  const start = minutesFromHHMM(scheduleStart(sc));
  const end = minutesFromHHMM(scheduleEnd(sc));

  return value >= start && value <= end;
}

function sortSchedulesByTime(items) {
  return [...(items || [])].sort((a, b) =>
    scheduleStart(a).localeCompare(scheduleStart(b))
  );
}

function pickClosestScheduleForDate(dateStr, items) {
  const ordered = sortSchedulesByTime(items);

  if (!ordered.length) return "";

  if (dateStr !== todayLocalDate()) {
    return ordered[0].id;
  }

  const nowMin = minutesFromHHMM(currentHHMM());

  const active = ordered.find((sc) => {
    const start = minutesFromHHMM(scheduleStart(sc));
    const end = minutesFromHHMM(scheduleEnd(sc));

    return nowMin >= start && nowMin <= end;
  });

  if (active) return active.id;

  const next = ordered.find((sc) => minutesFromHHMM(scheduleStart(sc)) >= nowMin);

  return next?.id || ordered[0].id;
}

function defaultTimeForSchedule(dateStr, sc) {
  if (!sc) return "";

  if (dateStr !== todayLocalDate()) {
    return scheduleStart(sc);
  }

  const now = currentHHMM();

  if (isTimeInsideSchedule(now, sc)) return now;

  return scheduleStart(sc);
}

export default function ProfSubjectDetail() {
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState("attendance");
  const [filterDate, setFilterDate] = useState(todayLocalDate());
  const [filterScheduleId, setFilterScheduleId] = useState("all");

  const [subjects, setSubjects] = useState([]);
  const subject = useMemo(() => subjects.find((s) => s.id === id), [subjects, id]);

  const [schedules, setSchedules] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState({ graceMinutes: 10 });

  const [showStats, setShowStats] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState([]);
  const [evidence, setEvidence] = useState([]);

  const [allStudents, setAllStudents] = useState([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const [schedForm, setSchedForm] = useState({
    dayOfWeek: 1,
    startTime: "13:00",
    endTime: "15:00",
  });

  const [manualForm, setManualForm] = useState({
    studentId: "",
    status: "present",
    date: todayLocalDate(),
    scheduleId: "",
    time: "",
  });

  const schedulesForFilterDate = useMemo(() => {
    const dow = getDayFromDate(filterDate);

    if (dow === null) return [];

    return sortSchedulesByTime(
      (schedules || []).filter((sc) => scheduleDow(sc) === dow)
    );
  }, [schedules, filterDate]);

  const schedulesForManualDate = useMemo(() => {
    const dow = getDayFromDate(manualForm.date);

    if (dow === null) return [];

    return sortSchedulesByTime(
      (schedules || []).filter((sc) => scheduleDow(sc) === dow)
    );
  }, [schedules, manualForm.date]);

  useEffect(() => {
    const validSchedule = schedulesForManualDate.find(
      (sc) => sc.id === manualForm.scheduleId
    );

    if (schedulesForManualDate.length === 0) {
      if (manualForm.scheduleId || manualForm.time) {
        setManualForm((prev) => ({
          ...prev,
          scheduleId: "",
          time: "",
        }));
      }

      return;
    }

    if (!validSchedule) {
      const nextScheduleId = pickClosestScheduleForDate(
        manualForm.date,
        schedulesForManualDate
      );

      setManualForm((prev) => ({
        ...prev,
        scheduleId: nextScheduleId,
        time: "",
      }));

      return;
    }

    if (!manualForm.time || !isTimeInsideSchedule(manualForm.time, validSchedule)) {
      setManualForm((prev) => ({
        ...prev,
        time: defaultTimeForSchedule(prev.date, validSchedule),
      }));
    }
  }, [
    manualForm.date,
    manualForm.scheduleId,
    manualForm.time,
    schedulesForManualDate,
  ]);

  // ✅ abrir/cerrar escáner
  const [scanOpen, setScanOpen] = useState(false);
  const [tapoOpen, setTapoOpen] = useState(false);


  // ✅ modal editar timestamp
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editTimestamp, setEditTimestamp] = useState("");

  const [manualQuery, setManualQuery] = useState("");
  const [manualDropdownOpen, setManualDropdownOpen] = useState(false);

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

      try {
        const s7 = await api(`/api/prof/subjects/${id}/evidence`);
        setEvidence(s7.evidence || []);
      } catch (evErr) {
        console.error("Error cargando evidencias:", evErr);
        // No bloqueamos el resto de la página si falla la evidencia
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
  if (status === "absent") return "Falta";
  return status;
}

function buildRange() {
  if (!filterDate) return { from: null, to: null };

  const [y, mon, d] = filterDate.split("-").map(Number);

  if (filterScheduleId === "all") {
    const from = new Date(y, mon - 1, d, 0, 0, 0);
    const to = new Date(y, mon - 1, d, 23, 59, 59);

    return { from, to };
  }

  const sc = schedulesForFilterDate.find((s) => s.id === filterScheduleId);

  if (!sc) return { from: null, to: null };

  const [sh, sm] = scheduleStart(sc).split(":").map(Number);
  const [eh, em] = scheduleEnd(sc).split(":").map(Number);

  const from = new Date(y, mon - 1, d, sh, sm, 0);
  const to = new Date(y, mon - 1, d, eh, em, 59);

  return { from, to };
}

const filteredAttendance = useMemo(() => {
  const { from, to } = buildRange();

  if (!from || !to) return attendance || [];

  return (attendance || []).filter((a) => {
    const t = new Date(a.timestamp);
    return t >= from && t <= to;
  });
}, [attendance, filterDate, filterScheduleId, schedulesForFilterDate]);

const rowsToDisplay = useMemo(() => {
  if (!filterDate) {
    return (enrollments || []).map((e) => ({
      enrollment: e,
      attendance: (attendance || [])
        .filter((a) => String(a.studentId) === String(e.studentId))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0],
    }));
  }

  if (filterScheduleId !== "all") {
    const sc = schedulesForFilterDate.find((s) => s.id === filterScheduleId);

    return (enrollments || []).map((e) => {
      const att = filteredAttendance.find(
        (a) =>
          String(a.studentId) === String(e.studentId) ||
          String(a.student?.id) === String(e.studentId)
      );

      return {
        enrollment: e,
        attendance: att,
        schedule: sc,
      };
    });
  }

  if (schedulesForFilterDate.length === 0) {
    return (enrollments || []).map((e) => ({
      enrollment: e,
      attendance: null,
      schedule: null,
    }));
  }

  const [y, mon, day] = filterDate.split("-").map(Number);
  const rows = [];

  schedulesForFilterDate.forEach((sc) => {
    const [sh, sm] = scheduleStart(sc).split(":").map(Number);
    const [eh, em] = scheduleEnd(sc).split(":").map(Number);

    const scFrom = new Date(y, mon - 1, day, sh, sm, 0);
    const scTo = new Date(y, mon - 1, day, eh, em, 59);

    enrollments.forEach((e) => {
      const att = (attendance || []).find((a) => {
        const t = new Date(a.timestamp);

        const isSameStudent =
          String(a.studentId) === String(e.studentId) ||
          String(a.student?.id) === String(e.studentId);

        return isSameStudent && t >= scFrom && t <= scTo;
      });

      rows.push({
        enrollment: e,
        attendance: att,
        schedule: sc,
      });
    });
  });

  return rows.sort((a, b) => {
    const nameA = (a.enrollment.student?.name || "").toLowerCase();
    const nameB = (b.enrollment.student?.name || "").toLowerCase();

    if (nameA !== nameB) return nameA.localeCompare(nameB);

    return scheduleStart(a.schedule).localeCompare(scheduleStart(b.schedule));
  });
}, [
  enrollments,
  attendance,
  filterDate,
  filterScheduleId,
  schedulesForFilterDate,
  filteredAttendance,
]);


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
      const fullName = `${s.name || ""} ${s.lastname || ""}`.toLowerCase();
      const email = String(s.email || "").toLowerCase();
      const code = String(s.studentCode || "").toLowerCase();
      return fullName.includes(q) || email.includes(q) || code.includes(q);
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

  if (!manualForm.studentId) {
    return showAlert("warning", "Atención", "Selecciona un estudiante.");
  }

  if (!manualForm.date) {
    return showAlert("warning", "Atención", "Selecciona una fecha.");
  }

  if (schedulesForManualDate.length === 0) {
    return showAlert(
      "warning",
      "Sin horario",
      "No hay horario de clase para la fecha seleccionada."
    );
  }

  const selectedSchedule = schedulesForManualDate.find(
    (sc) => sc.id === manualForm.scheduleId
  );

  if (!selectedSchedule) {
    return showAlert(
      "warning",
      "Atención",
      "Selecciona un horario válido para esa fecha."
    );
  }

  if (!manualForm.time) {
    return showAlert("warning", "Atención", "Selecciona la hora.");
  }

  if (!isTimeInsideSchedule(manualForm.time, selectedSchedule)) {
    return showAlert(
      "warning",
      "Hora fuera de rango",
      `La hora debe estar entre ${scheduleStart(selectedSchedule)} y ${scheduleEnd(selectedSchedule)}.`
    );
  }

  try {
    const timestamp = `${manualForm.date} ${manualForm.time}:00`;

    await api(`/api/prof/subjects/${id}/attendance/manual`, {
      method: "POST",
      body: {
        ...manualForm,
        timestamp,
      },
    });

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

    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    
    const dateStr = `${y}-${mo}-${d}`;
    const timeStr = `${h}-${mi}`;
    const subjectName = (subject?.name || "Asistencia").replace(/[^a-z0-9]/gi, "_");

    const a = document.createElement("a");
    a.href = dl;
    a.download = `${subjectName}_${dateStr}_${timeStr}.xlsx`;
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

  const filteredManualStudents = useMemo(() => {
    const q = manualQuery.toLowerCase().trim();
    if (!q) return studentsForSelect;
    return studentsForSelect.filter(s => {
      const fn = `${s.name || ""} ${s.lastname || ""}`.toLowerCase();
      const email = String(s.email || "").toLowerCase();
      const code = String(s.studentCode || "").toLowerCase();
      return fn.includes(q) || email.includes(q) || code.includes(q);
    });
  }, [studentsForSelect, manualQuery]);

  const selectedManualStudent = useMemo(() => {
    return studentsForSelect.find(s => s.id === manualForm.studentId);
  }, [studentsForSelect, manualForm.studentId]);

  // Estadísticas rápidas
  const today = new Date().toLocaleDateString('en-CA');
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
          { id: "stats", label: "Estadísticas", icon: FaChartLine },
          { id: "evidence", label: "Evidencia", icon: FaImage },
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
                
                {/* Escáner Card 
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
                          showAlert("success", "¡Éxito!", "Asistencia procesada (Tapo).");
                        }}
                      />
                    </div>
                  )}
                </div>
*/}
                {/* Registro Manual Card */}
<div className="card glass-card">
  <h3 className="title text-sm">Registro Manual</h3>

  <form onSubmit={manualMark} className="mt-3 space-y-3">
    <div className="relative">
      <label className="label">Estudiante</label>

      <div
        className={`input flex items-center justify-between cursor-pointer ${
          manualDropdownOpen ? "ring-2 ring-red-500" : ""
        }`}
        onClick={() => setManualDropdownOpen(!manualDropdownOpen)}
      >
        <span
          className={
            selectedManualStudent ? "text-brand-dark font-bold" : "text-gray-400"
          }
        >
          {selectedManualStudent
            ? `${selectedManualStudent.name} ${selectedManualStudent.lastname || ""}`
            : "-- Seleccionar Estudiante --"}
        </span>

        <FaUserGraduate className="text-gray-400" />
      </div>

      {manualDropdownOpen && (
        <div className="absolute z-[60] left-0 right-0 mt-1 bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 bg-gray-50 border-b border-gray-100 sticky top-0">
            <input
              autoFocus
              className="input text-sm py-1.5"
              placeholder="Buscar por nombre, email o código..."
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-[250px] overflow-y-auto">
            {filteredManualStudents.length > 0 ? (
              filteredManualStudents.map((s) => (
                <div
                  key={s.id}
                  className={`p-3 cursor-pointer transition-all hover:bg-red-50 flex flex-col gap-0.5 ${
                    manualForm.studentId === s.id
                      ? "bg-red-50 border-l-4 border-red-500"
                      : "border-l-4 border-transparent"
                  }`}
                  onClick={() => {
                    setManualForm({
                      ...manualForm,
                      studentId: s.id,
                    });
                    setManualDropdownOpen(false);
                    setManualQuery("");
                  }}
                >
                  <div className="font-bold text-sm text-brand-dark">
                    {s.name} {s.lastname || ""}
                  </div>

                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {s.studentCode} • {s.email}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 italic text-sm">
                No se encontraron estudiantes matriculados
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="label">Fecha</label>

        <input
          type="date"
          className="input"
          value={manualForm.date}
          onChange={(e) =>
            setManualForm({
              ...manualForm,
              date: e.target.value,
              scheduleId: "",
              time: "",
            })
          }
        />
      </div>

      <div>
        <label className="label">Horario</label>

        <select
          className="input"
          value={manualForm.scheduleId}
          disabled={schedulesForManualDate.length === 0}
          onChange={(e) =>
            setManualForm({
              ...manualForm,
              scheduleId: e.target.value,
              time: "",
            })
          }
        >
          {schedulesForManualDate.length === 0 ? (
            <option value="">Sin horario para este día</option>
          ) : (
            schedulesForManualDate.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {DAYS[scheduleDow(sc)]} {scheduleStart(sc)} - {scheduleEnd(sc)}
              </option>
            ))
          )}
        </select>
      </div>
    </div>

    {schedulesForManualDate.length === 0 && (
      <p className="text-xs text-red-600 font-semibold mt-1">
        Sin horario para esta fecha. No se puede registrar asistencia manual.
      </p>
    )}

    {manualForm.scheduleId && (
      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
        <label className="label">Hora de Registro</label>

        <input
          type="time"
          className="input"
          value={manualForm.time}
          min={scheduleStart(
            schedulesForManualDate.find((s) => s.id === manualForm.scheduleId)
          )}
          max={scheduleEnd(
            schedulesForManualDate.find((s) => s.id === manualForm.scheduleId)
          )}
          onChange={(e) =>
            setManualForm({
              ...manualForm,
              time: e.target.value,
            })
          }
        />

        <p className="text-[10px] text-gray-500 mt-1">
          Rango permitido:{" "}
          {scheduleStart(
            schedulesForManualDate.find((s) => s.id === manualForm.scheduleId)
          )}{" "}
          a{" "}
          {scheduleEnd(
            schedulesForManualDate.find((s) => s.id === manualForm.scheduleId)
          )}
        </p>
      </div>
    )}

    <button
      className="btn w-full"
      type="submit"
      disabled={schedulesForManualDate.length === 0 || !manualForm.scheduleId}
    >
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
        onChange={(e) => {
          setFilterDate(e.target.value);
          setFilterScheduleId("all");
        }}
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

        {schedulesForFilterDate.map((sc) => (
          <option key={sc.id} value={sc.id}>
            {DAYS[scheduleDow(sc)]} {scheduleStart(sc)} - {scheduleEnd(sc)}
          </option>
        ))}
      </select>

      {filterDate && schedulesForFilterDate.length === 0 && (
        <p className="text-xs text-red-600 font-semibold mt-1">
          Sin horarios para esta fecha.
        </p>
      )}
    </div>

    <div className="flex gap-2">
      <button
        type="button"
        className="btn secondary py-2 px-3"
        onClick={() => {
          setFilterDate(todayLocalDate());
          setFilterScheduleId("all");
        }}
        title="Volver a hoy"
      >
        <FaTrash />
      </button>

      <button
        className="btn flex items-center gap-2 py-2 px-4"
        type="button"
        onClick={exportExcel}
      >
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
                      Total Filas: {rowsToDisplay.length}
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
                        {(rowsToDisplay || []).map((row, idx) => {
                          const e = row.enrollment;
                          const a = row.attendance;
                          const sc = row.schedule;

                          const status = a?.status ?? "absent";
                          const timestamp = a?.timestamp ?? null;
                          const method = a?.method ?? "-";

                          return (
                            <tr key={a?.id || `row-${e.studentId}-${sc?.id || idx}`}>
                              <td>
                                <div className="font-bold">
                                  {a?.student 
                                    ? <>{a.student.name} {a.student.lastname || ""}</>
                                    : (e.student ? <>{e.student.name} {e.student.lastname || ""}</> : "N/A")}
                                </div>
                                <div className="text-[10px] muted uppercase flex items-center gap-2">
                                  <span>{a?.student?.studentCode || e.student?.studentCode || "-"}</span>
                                  {sc && (
                                    <span className="badge secondary text-[9px] py-0 px-1">
                                      {sc.startTime} - {sc.endTime}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="muted text-xs">
                                {timestamp ? (
                                  // Si el timestamp viene como string ISO local (YYYY-MM-DDTHH:mm:ss), 
                                  // lo formateamos directamente para evitar conversiones de zona horaria
                                  typeof timestamp === 'string' && timestamp.includes('T')
                                    ? timestamp.replace('T', ' ')
                                    : new Date(timestamp).toLocaleString()
                                ) : "-"}
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
                        <div className="font-bold">
                          {s.name} {s.lastname || ""}
                        </div>
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
                            <div className="font-bold">
                              {e.student?.name} {e.student?.lastname || ""}
                            </div>
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
                      <td className="font-bold">
                        {s.name} {s.lastname || ""}
                      </td>
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
            TAB: EVIDENCIA
           ====================================================== */}
        {activeTab === "evidence" && (
          <div className="space-y-6">
            <div className="card glass-card">
              <h3 className="title flex items-center gap-2">
                <FaImage className="text-red-600" />
                Capturas Automáticas (Evidencia)
              </h3>
              <p className="muted text-sm">
                Aquí se muestran las fotos tomadas automáticamente por el sistema Tapo durante las clases de esta asignatura.
              </p>

              {evidence.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex p-4 bg-gray-50 rounded-full mb-4">
                    <FaImage className="text-4xl text-gray-200" />
                  </div>
                  <p className="text-gray-400 italic">No hay capturas registradas para esta materia aún.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                  {evidence.map((ev) => (
                    <div key={ev.id} className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                      <div className="aspect-video overflow-hidden bg-gray-100">
                        <img 
                          src={`${import.meta.env.VITE_API_URL || "http://localhost:4000"}${ev.viewUrl}`} 
                          alt={ev.shot_type}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.target.src = "https://placehold.co/600x400?text=Error+al+cargar+imagen";
                          }}
                        />
                      </div>
                      <div className="p-4 bg-white">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`badge ${
                            ev.shot_type === "MID_30" ? "ok" : "secondary"
                          } text-[10px] uppercase font-black`}>
                            {ev.shot_type === "EARLY_5" ? "Inicio" : ev.shot_type === "GRACE_END" ? "Fin Gracia" : "Intermedio"}
                          </span>
                          <span className="text-[10px] muted font-mono">{new Date(ev.taken_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs font-bold text-brand-dark mb-1">
                          {new Date(ev.taken_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <div className="text-[10px] text-gray-400 truncate">
                          Archivo: {ev.file_name}
                        </div>
                      </div>
                      <a 
                        href={`${import.meta.env.VITE_API_URL || "http://localhost:4000"}${ev.viewUrl}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm"
                      >
                        Ver Pantalla Completa
                      </a>
                    </div>
                  ))}
                </div>
              )}
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
                  <label className="label text-gray-700">TIEMPO DE GRACIA PARA EL SEGUNDO BARRIDO (MINUTOS)</label>
                  <p className="text-xs text-gray-500 mb-3">
                    Define cuántos minutos después de iniciar la clase se realizará la segunda captura (barrido). Los estudiantes detectados dentro de este tiempo serán registrados como “Presente”. Quienes no sean detectados en este barrido serán registrados como “Falta”.
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
                Cambiando registro de: <b className="text-gray-700">{editItem?.student?.name} {editItem?.student?.lastname || ""}</b>
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
