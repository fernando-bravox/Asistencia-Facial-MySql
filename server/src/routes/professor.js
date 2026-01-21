import { Router } from "express";
import { nanoid } from "nanoid";
import ExcelJS from "exceljs";
import { sendAttendanceEmail } from "../utils/mailer.js";

import { spawn } from "child_process";


import { requireAuth, requireRole } from "../middleware/requireAuth.js";

import { matchSchedule } from "../utils/time.js";

// ✅ MySQL helpers
import { queryWhere, findOne, getById, upsert, remove } from "../utils/mysqlDb.js";

export const profRouter = Router();
profRouter.use(requireAuth(), requireRole("professor"));


function buildSessionKey({ subjectId, timestampISO, matchedSc }) {
  const todayKey = dateKeyInTZ(new Date(timestampISO));
  return `${subjectId}|${todayKey}|${matchedSc.dayOfWeek}|${matchedSc.startTime}-${matchedSc.endTime}`;

}
// =========================
// ✅ STREAM TAPO (RTSP -> MJPEG) para usar en el frontend
// =========================
profRouter.get("/subjects/:id/camera/stream", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const rtsp = process.env.TAPO_RTSP_URL;
  if (!rtsp) return res.status(500).json({ error: "Falta TAPO_RTSP_URL en .env" });

  // MJPEG multipart (para <img src="...">)
  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=ffmpeg",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Connection": "close",
  });

  const ff = spawn(
    "ffmpeg",
    [
      "-rtsp_transport", "tcp",
      "-i", rtsp,
      "-vf", "fps=8,scale=640:-1",
      "-f", "mpjpeg",
      "-q:v", "6",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "ignore"] }
  );

  ff.stdout.pipe(res);

  const kill = () => {
    try { ff.kill("SIGKILL"); } catch (_e) {}
  };

  req.on("close", kill);
  req.on("error", kill);
  ff.on("error", kill);
});

// =========================
// Utils
// =========================
function dateKeyInTZ(date, tz = "America/Guayaquil") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

async function ensureSubjectOwner(subjectId, professorId) {
  const subject = await getById("subjects", subjectId);
  if (!subject) return { error: "Materia no encontrada", status: 404 };

  const owner = subject.professorId ?? subject.professor_id;
  if (String(owner) !== String(professorId)) return { error: "No eres dueño de esta materia", status: 403 };

  return { subject };
}



async function generateUniqueSubjectCode() {
  for (let i = 0; i < 10; i++) {
    const code = `SUB-${nanoid(5).toUpperCase()}`;
    const exists = await findOne("subjects", "code", code);
    if (!exists) return code;
  }
  return `SUB-${nanoid(8).toUpperCase()}`;
}


// =========================
// ✅ LISTAR ESTUDIANTES (ComboBox)
// =========================
profRouter.get("/students", async (_req, res) => {
  const students = await queryWhere("users", "role", "==", "student");
  res.json({
    students: (students || []).map((s) => ({
      id: s.id,
      name: s.name || "",
      email: s.email || "",
      studentCode: s.studentCode || "",
      faceId: s.faceId || null,
    })),
  });
});


// =========================
// SUBJECTS (MySQL)
// =========================
profRouter.get("/subjects", async (req, res) => {
  try {
    let subjects = await queryWhere("subjects", "professor_id", "==", req.user.id);
subjects = (subjects || []).sort(
  (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
);

    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

profRouter.post("/subjects", async (req, res) => {
  try {
    const { name, room } = req.body || {};
    if (!name) return res.status(400).json({ error: "Nombre requerido" });

    const code = await generateUniqueSubjectCode();
    const subjectId = nanoid();
    const nowISO = new Date().toISOString();

    await upsert("subjects", subjectId, {
      name: String(name).trim(),
      code,
      room: room ? String(room).trim() : "",
      professor_id: req.user.id,
      created_at: nowISO,
    });

    await upsert("settings", subjectId, {
      subject_id: subjectId,
      grace_minutes: 10,
      updated_at: nowISO,
    });

    const subject = await getById("subjects", subjectId);
    res.status(201).json({ subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

profRouter.put("/subjects/:id", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const { name, room } = req.body || {};
    const patch = {};
    if (name) patch.name = String(name).trim();
    if (typeof room !== "undefined") patch.room = String(room || "").trim();

    await upsert("subjects", req.params.id, patch);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

profRouter.delete("/subjects/:id", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);
    if (check.error) return res.status(check.status).json({ error: check.error });

    await remove("subjects", req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// =========================
// SCHEDULES (MySQL)
// =========================
profRouter.get("/subjects/:id/schedules", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

const schedules = await queryWhere("schedules", "subject_id", "==", req.params.id);
  res.json({ schedules });
});

profRouter.post("/subjects/:id/schedules", async (req, res) => {
  const { dayOfWeek, startTime, endTime } = req.body || {};
  if (dayOfWeek === undefined || !startTime || !endTime) return res.status(400).json({ error: "Faltan campos" });

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const scheduleId = nanoid();
  const nowISO = new Date().toISOString();

  await upsert("schedules", scheduleId, {
    subject_id: req.params.id,
    day_of_week: Number(dayOfWeek),
    start_time: startTime,
    end_time: endTime,
    created_at: nowISO,
  });

  const schedule = await getById("schedules", scheduleId);
  res.status(201).json({ schedule });
});

profRouter.delete("/subjects/:id/schedules/:scheduleId", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await remove("schedules", req.params.scheduleId);
  res.json({ ok: true });
});



// =========================
// SETTINGS (MySQL)
// =========================
profRouter.get("/subjects/:id/settings", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const st = await getById("settings", req.params.id);
const grace = st?.grace_minutes ?? st?.graceMinutes ?? 10;
res.json({ settings: { graceMinutes: Number(grace) } });

});

profRouter.put("/subjects/:id/settings", async (req, res) => {
  const { graceMinutes } = req.body || {};

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const nowISO = new Date().toISOString();

  await upsert("settings", req.params.id, {
    grace_minutes: Number(graceMinutes || 10),
    updated_at: nowISO,
  });

  res.json({ ok: true });
});


// =========================
// ENROLLMENTS ( MySql + Students MySql )
// =========================
profRouter.get("/subjects/:id/enrollments", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const enrollmentsRaw = await queryWhere("enrollments", "subject_id", "==", req.params.id);

  const enrollments = await Promise.all(
    (enrollmentsRaw || []).map(async (e) => {
      const st = await getById("users", e.studentId); // ✅ camelCase
      return {
        id: e.id,
        subjectId: e.subjectId,     // ✅ camelCase
        studentId: e.studentId,     // ✅ camelCase
        createdAt: e.createdAt,     // ✅ camelCase
        student: st
          ? {
              id: st.id,
              name: st.name,
              email: st.email,
              studentCode: st.studentCode || "",
              faceId: st.faceId || null,
              faceDescriptor: st.faceDescriptor || null,
            }
          : null,
      };
    })
  );

  res.json({ enrollments });
});



profRouter.post("/subjects/:id/enrollments", async (req, res) => {
  const { studentEmail, studentId } = req.body || {};

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  let student = null;

  if (studentId) student = await getById("users", studentId);

  if (!student && studentEmail) {
    student = await findOne("users", "email", String(studentEmail).toLowerCase());
  }

  if (!student) return res.status(404).json({ error: "Estudiante no encontrado" });

  const role = student.role || student.rol;
  if (role !== "student") return res.status(404).json({ error: "Estudiante no encontrado" });

  // ✅ validar duplicado en MySQL
  const exists = await queryWhere("enrollments", "subject_id", "==", req.params.id);
  const dup = (exists || []).some((x) => String(x.student_id) === String(student.id));
  if (dup) return res.status(409).json({ error: "Ya está matriculado" });

  const enrollmentId = nanoid();
  const nowISO = new Date().toISOString();

  await upsert("enrollments", enrollmentId, {
    subject_id: req.params.id,
    student_id: student.id,
    created_at: nowISO,
  });

  const enrollment = await getById("enrollments", enrollmentId);
  res.status(201).json({ enrollment });
});


profRouter.delete("/subjects/:id/enrollments/:enrollmentId", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await remove("enrollments", req.params.enrollmentId);
  res.json({ ok: true });
});


// =========================
// ATTENDANCE (MySQL)
// =========================

profRouter.get("/subjects/:id/attendance", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const { from, to, onlyPending } = req.query;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  let items = await queryWhere("attendance", "subject_id", "==", req.params.id);
  items = items || [];

  if (onlyPending === "true") items = items.filter((a) => (a.approval_status || a.approvalStatus) === "pending");
  if (fromDate) items = items.filter((a) => new Date(a.timestamp) >= fromDate);
  if (toDate) items = items.filter((a) => new Date(a.timestamp) <= toDate);

  const enriched = await Promise.all(
    items.map(async (a) => {
      const st = await getById("users", a.studentId);
      return {
        id: a.id,
        subjectId: a.subjectId,
studentId: a.studentId,
        timestamp: a.timestamp,
        method: a.method,
        status: a.status,
        approvalStatus: a.approval_status || a.approvalStatus,
        sessionKey: a.session_key || a.sessionKey,
        createdAt: a.createdAt,
        student: st
          ? { id: st.id, name: st.name, email: st.email, studentCode: st.studentCode || st.student_code || "" }
          : null,
      };
    })
  );

  res.json({ attendance: enriched });
});


profRouter.delete("/subjects/:id/attendance/:attendanceId", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const row = await getById("attendance", req.params.attendanceId);
  if (!row) return res.status(404).json({ error: "Registro no encontrado" });

  await remove("attendance", req.params.attendanceId);
  res.json({ ok: true });
});


profRouter.put("/subjects/:id/attendance/:attendanceId/timestamp", async (req, res) => {
  const { timestamp } = req.body || {};
  if (!timestamp) return res.status(400).json({ error: "timestamp requerido" });

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const parsed = new Date(timestamp);
  if (isNaN(parsed.getTime())) return res.status(400).json({ error: "timestamp inválido" });

  await upsert("attendance", req.params.attendanceId, {
  timestamp: parsed.toISOString(),
});



  res.json({ ok: true });
});

async function buildSessionForNow(subjectId, tsISO) {
  // schedules desde MySQL
  const subjectSchedules = await queryWhere("schedules", "subject_id", "==", subjectId);

  // settings desde MySQL
  const setRow = await getById("settings", subjectId);
  const graceMinutes = setRow ? Number(setRow.grace_minutes ?? setRow.graceMinutes ?? 10) : 10;

  let status = null;
  let matchedSc = null;

  for (const sc of subjectSchedules || []) {
    const schedule = {
      dayOfWeek: sc.day_of_week ?? sc.dayOfWeek,
      startTime: sc.start_time ?? sc.startTime,
      endTime: sc.end_time ?? sc.endTime,
    };

    const m = matchSchedule({ schedule, timestampISO: tsISO, graceMinutes });
    if (m.match) {
      status = m.status;
      matchedSc = schedule;
      break;
    }
  }

  if (!status || !matchedSc) return null;

  const todayKey = dateKeyInTZ(new Date(tsISO));
  const sessionKey = `${subjectId}|${todayKey}|${matchedSc.dayOfWeek}|${matchedSc.startTime}-${matchedSc.endTime}`;

  return { status, matchedSc, sessionKey };
}

async function alreadyMarked(subjectId, studentId, sessionKey) {
  const attRows = await queryWhere("attendance", "subject_id", "==", subjectId);

  return (attRows || []).some((a) => {
    const sid = a.student_id || a.studentId;
    const sk = a.session_key || a.sessionKey || null;
    return String(sid) === String(studentId) && String(sk) === String(sessionKey);
  });
}

profRouter.post("/subjects/:id/attendance/manual", async (req, res) => {
  const { studentId, status } = req.body || {};
  if (!studentId) return res.status(400).json({ error: "studentId requerido" });

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const student = await getById("users", studentId);
  const role = student?.role || student?.rol;
  if (!student || role !== "student") return res.status(404).json({ error: "Estudiante no encontrado" });

  const subjectId = req.params.id;
  const nowISO = new Date().toISOString();

  // ✅ MISMA sesión que usa SCAN (misma lógica)
  const ses = await buildSessionForNow(subjectId, nowISO);
  if (!ses) {
    return res.status(202).json({ ok: true, message: "No hay clase en curso para esta materia." });
  }

  // ✅ Bloqueo real (manual también)
  const exists = await alreadyMarked(subjectId, studentId, ses.sessionKey);
  if (exists) {
    return res.json({
      ok: true,
      alreadyMarked: true,
      message: "El estudiante ya fue registrado en esta clase.",
      student: { id: student.id, name: student.name, email: student.email },
    });
  }

  const attendanceId = `${studentId}_${ses.sessionKey}`.replace(/[|:\s]/g, "_");

  await upsert("attendance", attendanceId, {
    subject_id: subjectId,
    student_id: studentId,
    timestamp: nowISO,
    method: "manual",
    status: status || ses.status || "present",
    approval_status: "approved",
    session_key: ses.sessionKey,          // ✅ clave
    created_at: nowISO,
  });

  // subjectName desde MySQL
  const subject = await getById("subjects", subjectId);
  const subjectName = subject?.name || "";

  try {
    await sendAttendanceEmail({
      to: student.email,
      studentName: student.name,
      subjectName,
      status: status || ses.status || "present",
      timestampISO: nowISO,
    });
  } catch (error) {
    console.error("❌ Error enviando correo (manual):", error);
  }

  const saved = await getById("attendance", attendanceId);
  res.status(201).json({ attendance: saved });
});



// Scan mark (profesor) ✅ MySQL
profRouter.post("/subjects/:id/attendance/scan", async (req, res) => {
  const { faceId, timestamp } = req.body || {};
  if (!faceId) return res.status(400).json({ error: "faceId requerido" });

  const ts = timestamp || new Date().toISOString();

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const subjectId = req.params.id;

  // schedules desde MySQL
  const subjectSchedules = await queryWhere("schedules", "subject_id", "==", subjectId);

  // settings desde MySQL
  const setRow = await getById("settings", subjectId);
  const settings = setRow ? { graceMinutes: setRow.grace_minutes ?? setRow.graceMinutes ?? 10 } : { graceMinutes: 10 };

  let status = null;
  let matchedSc = null;

  for (const sc of subjectSchedules || []) {
    const schedule = {
      dayOfWeek: sc.day_of_week ?? sc.dayOfWeek,
      startTime: sc.start_time ?? sc.startTime,
      endTime: sc.end_time ?? sc.endTime,
    };

    const m = matchSchedule({ schedule, timestampISO: ts, graceMinutes: settings.graceMinutes });
    if (m.match) {
      status = m.status;
      matchedSc = schedule;
      break;
    }
  }

  if (!status || !matchedSc) {
    return res.status(202).json({ ok: true, message: "No hay clase en curso para esta materia." });
  }

  // buscar estudiante por faceId en MySQL
  const student = await findOne("users", "face_id", String(faceId).trim());
  const studentAlt = student ? student : await findOne("users", "faceId", String(faceId).trim());
  const st = studentAlt;

  if (!st) return res.status(404).json({ error: "No existe estudiante con ese faceId" });

  // validar matrícula en MySQL
  const enr = await queryWhere("enrollments", "subject_id", "==", subjectId);
  const enrolled = (enr || []).some((x) => String(x.studentId) === String(st.id));
  if (!enrolled) return res.status(403).json({ error: "El estudiante no está matriculado en esta materia" });

  // evitar duplicado
  const todayKey = dateKeyInTZ(new Date(ts));
  const sessionKey = `${subjectId}|${todayKey}|${matchedSc.dayOfWeek}|${matchedSc.startTime}-${matchedSc.endTime}`;

  const attRows = await queryWhere("attendance", "subject_id", "==", subjectId);
  const already = (attRows || []).some((a) => String(a.studentId) === String(st.id) && String(a.session_key || a.sessionKey) === sessionKey);

  if (already) {
    return res.json({
      ok: true,
      alreadyMarked: true,
      message: "El estudiante ya fue registrado en esta clase.",
      student: { id: st.id, name: st.name, email: st.email },
    });
  }

  const attendanceId = `${st.id}_${sessionKey}`.replace(/[|:\s]/g, "_");
  const nowISO = new Date().toISOString();

  await upsert("attendance", attendanceId, {
    subject_id: subjectId,
    student_id: st.id,
    timestamp: ts,
    method: "prof_device",
    status,
    approval_status: "approved",
    session_key: sessionKey,
    created_at: nowISO,
  });

  // subjectName desde MySQL
  const subject = await getById("subjects", subjectId);
  const subjectName = subject?.name || "";

  try {
    await sendAttendanceEmail({
      to: st.email,
      studentName: st.name,
      subjectName,
      status,
      timestampISO: nowISO,
    });
  } catch (error) {
    console.error("❌ Error enviando correo (scan):", error);
  }

  const saved = await getById("attendance", attendanceId);

  return res.status(201).json({
    ok: true,
    alreadyMarked: false,
    stored: saved,
    student: { id: st.id, name: st.name, email: st.email },
  });
});

// Approve / Reject
profRouter.post("/subjects/:id/attendance/:attendanceId/approve", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await upsert("attendance", req.params.attendanceId, {
    approval_status: "approved",
    approved_at: new Date().toISOString(),
  });

  res.json({ ok: true });
});

profRouter.post("/subjects/:id/attendance/:attendanceId/reject", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await upsert("attendance", req.params.attendanceId, {
    approval_status: "rejected",
    rejected_at: new Date().toISOString(),
  });

  res.json({ ok: true });
});


// Export Excel
// Export Excel (MySQL)
// Export Excel (MySQL) ✅ Incluye FALTAS
profRouter.get("/subjects/:id/attendance/export", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const { from, to } = req.query;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const subjectId = req.params.id;

  // 1) Traer matriculados (enrollments)
  const enrollmentsRaw = await queryWhere("enrollments", "subject_id", "==", subjectId);
  const enrollments = enrollmentsRaw || [];

  // 2) Traer asistencia (filtrada) y excluir rechazados
  let items = await queryWhere("attendance", "subject_id", "==", subjectId);
  items = items || [];

  items = items.filter((a) => (a.approval_status || a.approvalStatus) !== "rejected");
  if (fromDate) items = items.filter((a) => new Date(a.timestamp) >= fromDate);
  if (toDate) items = items.filter((a) => new Date(a.timestamp) <= toDate);

  // 3) Mapear asistencia por studentId (para saber quién tiene registro)
  const byStudent = new Map();
  for (const a of items) {
    const sid = a.student_id || a.studentId;
    if (sid) byStudent.set(String(sid), a);
  }

  // 4) Crear Excel
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Asistencia");

  ws.columns = [
    { header: "Código", key: "studentCode", width: 14 },
    { header: "Estudiante", key: "student", width: 30 },
    { header: "Email", key: "email", width: 28 },
    { header: "Fecha/Hora", key: "timestamp", width: 25 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Método", key: "method", width: 12 },
    { header: "Aprobación", key: "approvalStatus", width: 12 },
  ];

  // 5) Para cada matriculado: si tiene asistencia => fila real; si no => Falta
  for (const e of enrollments) {
    const studentId = e.student_id || e.studentId; // por si viene snake_case o camelCase
    if (!studentId) continue;

    const st = await getById("users", studentId);

    const a = byStudent.get(String(studentId));

    if (a) {
      ws.addRow({
        studentCode: st?.studentCode || st?.student_code || "",
        student: st?.name || "N/A",
        email: st?.email || "N/A",
        timestamp: a.timestamp,
        status: a.status === "present" ? "Presente" : a.status === "late" ? "Tarde" : a.status,
        method: a.method === "prof_device" ? "Sistema" : a.method === "manual" ? "Manual" : a.method,
        approvalStatus: a.approval_status || a.approvalStatus,
      });
    } else {
      // ❌ No existe registro => Falta
      ws.addRow({
        studentCode: st?.studentCode || st?.student_code || "",
        student: st?.name || "N/A",
        email: st?.email || "N/A",
        timestamp: "-",
        status: "Falta",
        method: "-",
        approvalStatus: "-",
      });
    }
  }

  ws.getRow(1).font = { bold: true };

  const fileBuffer = await wb.xlsx.writeBuffer();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="asistencia_${subjectId}.xlsx"`
  );
  res.send(Buffer.from(fileBuffer));
});


