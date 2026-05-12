import { Router } from "express";
import { nanoid } from "nanoid";
import ExcelJS from "exceljs";
import { sendAttendanceEmail } from "../utils/mailer.js";
import { spawn } from "child_process";

import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { matchSchedule } from "../utils/time.js";
import { pool } from "../utils/mysqlPool.js";

import {
  queryWhere,
  findOne,
  getById,
  upsert,
  remove,
} from "../utils/mysqlDb.js";

export const profRouter = Router();

profRouter.use(requireAuth(), requireRole("professor"));

// =========================
// Utils generales
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

function buildSessionKey({ subjectId, timestampISO, matchedSc }) {
  const todayKey = dateKeyInTZ(new Date(timestampISO));

  return `${subjectId}|${todayKey}|${matchedSc.dayOfWeek}|${matchedSc.startTime}-${matchedSc.endTime}`;
}

const DAYS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function dayOfWeekFromDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return null;

  const [y, m, d] = String(dateStr).split("-").map(Number);

  return new Date(y, m - 1, d).getDay();
}

function minutesFromHHMM(value) {
  const [h, m] = String(value || "00:00")
    .slice(0, 5)
    .split(":")
    .map(Number);

  return (h || 0) * 60 + (m || 0);
}

function isHHMMInsideSchedule(time, start, end) {
  const value = minutesFromHHMM(time);

  return value >= minutesFromHHMM(start) && value <= minutesFromHHMM(end);
}

function normalizeTimestamp({ date, time, fallbackTime, timestamp }) {
  let finalTimestamp = timestamp;

  if (!finalTimestamp || typeof finalTimestamp !== "string") {
    finalTimestamp = `${date} ${time || fallbackTime}:00`;
  } else {
    finalTimestamp = finalTimestamp.replace("T", " ").split(".")[0];

    if (!finalTimestamp.includes("-")) {
      finalTimestamp = `${date} ${finalTimestamp}`;
    }

    if (finalTimestamp.split(":").length === 2) {
      finalTimestamp += ":00";
    }
  }

  return finalTimestamp;
}

function normalizeUserName(user) {
  return `${user?.name || ""} ${
    user?.lastname || user?.lastName || user?.last_name || ""
  }`.trim();
}

async function ensureSubjectOwner(subjectId, professorId) {
  const subject = await getById("subjects", subjectId);

  if (!subject) {
    return {
      error: "Materia no encontrada",
      status: 404,
    };
  }

  const owner = subject.professorId ?? subject.professor_id;

  if (String(owner) !== String(professorId)) {
    return {
      error: "No eres dueño de esta materia",
      status: 403,
    };
  }

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

async function alreadyMarked(subjectId, studentId, sessionKey) {
  const attRows = await queryWhere("attendance", "subject_id", "==", subjectId);

  return (attRows || []).some((a) => {
    const sid = a.student_id || a.studentId;
    const sk = a.session_key || a.sessionKey || null;

    return String(sid) === String(studentId) && String(sk) === String(sessionKey);
  });
}

// =========================
// STREAM TAPO
// =========================
profRouter.get("/subjects/:id/camera/stream", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);

  if (check.error) {
    return res.status(check.status).json({ error: check.error });
  }

  const rtsp = process.env.TAPO_RTSP_URL;

  if (!rtsp) {
    return res.status(500).json({ error: "Falta TAPO_RTSP_URL en .env" });
  }

  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=ffmpeg",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Connection: "close",
  });

  const ff = spawn(
    "ffmpeg",
    [
      "-rtsp_transport",
      "tcp",
      "-i",
      rtsp,
      "-vf",
      "fps=6,scale=1280:-1",
      "-f",
      "mpjpeg",
      "-q:v",
      "6",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "ignore"] }
  );

  ff.stdout.pipe(res);

  const kill = () => {
    try {
      ff.kill("SIGKILL");
    } catch (_e) {}
  };

  req.on("close", kill);
  req.on("error", kill);
  ff.on("error", kill);
});

// =========================
// LISTAR ESTUDIANTES
// =========================
profRouter.get("/students", async (_req, res) => {
  try {
    const [students] = await pool.query(
      `SELECT id, name, lastname, email, student_code
       FROM users
       WHERE role = 'student'
       ORDER BY name ASC, lastname ASC`
    );

    res.json({
      students: (students || []).map((s) => ({
        id: s.id,
        name: s.name,
        lastname: s.lastname || "",
        email: s.email,
        studentCode: s.student_code || "",
      })),
    });
  } catch (err) {
    console.error("Error al listar estudiantes:", err);

    res.status(500).json({
      error: "Error al listar estudiantes",
      detail: err.message,
    });
  }
});

// =========================
// SUBJECTS
// =========================
profRouter.get("/subjects", async (req, res) => {
  try {
    let subjects = await queryWhere("subjects", "professor_id", "==", req.user.id);

    subjects = (subjects || []).sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );

    res.json({ subjects });
  } catch (err) {
    console.error("Error al listar materias:", err);

    res.status(500).json({
      error: "Error al listar materias",
      detail: err.message,
    });
  }
});

profRouter.post("/subjects", async (req, res) => {
  try {
    const { name, room } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: "Nombre requerido" });
    }

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
      grace_minutes: 10,
      updated_at: nowISO,
    });

    const subject = await getById("subjects", subjectId);

    res.status(201).json({ subject });
  } catch (err) {
    console.error("Error al crear materia:", err);

    res.status(500).json({
      error: "Error al crear materia",
      detail: err.message,
    });
  }
});

// ============================
// UPDATE SUBJECT
// ============================
profRouter.put("/subjects/:id", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const { name, code, room } = req.body || {};

    console.log("📝 [PROF] Body recibido para actualizar materia:", req.body);

    const updateFields = [];
    const updateValues = [];

    if (typeof name !== "undefined") {
      const cleanName = String(name || "").trim();

      if (!cleanName) {
        return res.status(400).json({
          error: "El nombre de la materia no puede estar vacío",
        });
      }

      updateFields.push("name = ?");
      updateValues.push(cleanName);
    }

    if (typeof code !== "undefined") {
      updateFields.push("code = ?");
      updateValues.push(String(code || "").trim() || null);
    }

    if (typeof room !== "undefined") {
      updateFields.push("room = ?");
      updateValues.push(String(room || "").trim() || "");
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: "No hay datos para actualizar",
      });
    }

    updateValues.push(req.params.id);

    const [result] = await pool.query(
      `UPDATE subjects
       SET ${updateFields.join(", ")}
       WHERE id = ?`,
      updateValues
    );

    console.log("✅ [PROF] Resultado UPDATE materia:", result);

    const [updatedRows] = await pool.query(
      `SELECT id, name, code, room, professor_id, created_at
       FROM subjects
       WHERE id = ?
       LIMIT 1`,
      [req.params.id]
    );

    res.json({
      ok: true,
      subject: updatedRows[0],
    });
  } catch (err) {
    console.error("Error al actualizar materia:", err);

    res.status(500).json({
      error: "Error al actualizar materia",
      detail: err.message,
    });
  }
});

profRouter.delete("/subjects/:id", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    await remove("subjects", req.params.id);

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar materia:", err);

    res.status(500).json({
      error: "Error al eliminar materia",
      detail: err.message,
    });
  }
});

// =========================
// SCHEDULES
// =========================
profRouter.get("/subjects/:id/schedules", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const schedules = await queryWhere("schedules", "subject_id", "==", req.params.id);

    const sortedSchedules = (schedules || []).sort((a, b) => {
      const dayA = Number(a.day_of_week ?? a.dayOfWeek);
      const dayB = Number(b.day_of_week ?? b.dayOfWeek);
      const timeA = String(a.start_time ?? a.startTime ?? "");
      const timeB = String(b.start_time ?? b.startTime ?? "");

      if (dayA !== dayB) return dayA - dayB;

      return timeA.localeCompare(timeB);
    });

    res.json({ schedules: sortedSchedules });
  } catch (err) {
    console.error("Error al listar horarios:", err);

    res.status(500).json({
      error: "Error al listar horarios",
      detail: err.message,
    });
  }
});

profRouter.post("/subjects/:id/schedules", async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime } = req.body || {};

    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

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
  } catch (err) {
    console.error("Error al crear horario:", err);

    res.status(500).json({
      error: "Error al crear horario",
      detail: err.message,
    });
  }
});

profRouter.delete("/subjects/:id/schedules/:scheduleId", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    await remove("schedules", req.params.scheduleId);

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar horario:", err);

    res.status(500).json({
      error: "Error al eliminar horario",
      detail: err.message,
    });
  }
});

// =========================
// SETTINGS
// =========================
profRouter.get("/subjects/:id/settings", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const st = await getById("settings", req.params.id);
    const grace = st?.grace_minutes ?? st?.graceMinutes ?? 10;

    res.json({
      settings: {
        graceMinutes: Number(grace),
      },
    });
  } catch (err) {
    console.error("Error al obtener configuración:", err);

    res.status(500).json({
      error: "Error al obtener configuración",
      detail: err.message,
    });
  }
});

profRouter.put("/subjects/:id/settings", async (req, res) => {
  try {
    const { graceMinutes } = req.body || {};

    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const nowISO = new Date().toISOString();

    await upsert("settings", req.params.id, {
      grace_minutes: Number(graceMinutes || 10),
      updated_at: nowISO,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al actualizar configuración:", err);

    res.status(500).json({
      error: "Error al actualizar configuración",
      detail: err.message,
    });
  }
});

// =========================
// ENROLLMENTS
// =========================
profRouter.get("/subjects/:id/enrollments", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const enrollmentsRaw = await queryWhere(
      "enrollments",
      "subject_id",
      "==",
      req.params.id
    );

    const enrollments = await Promise.all(
      (enrollmentsRaw || []).map(async (e) => {
        const studentId = e.studentId || e.student_id;

        const [rows] = await pool.query(
          `SELECT id, name, lastname, email, student_code
           FROM users
           WHERE id = ?
           LIMIT 1`,
          [studentId]
        );

        const st = rows[0] || null;

        return {
          id: e.id,
          subjectId: e.subjectId || e.subject_id,
          studentId,
          createdAt: e.createdAt || e.created_at,
          student: st
            ? {
                id: st.id,
                name: st.name,
                lastname: st.lastname || "",
                email: st.email,
                studentCode: st.student_code || "",
              }
            : null,
        };
      })
    );

    res.json({ enrollments });
  } catch (err) {
    console.error("Error al listar matrículas:", err);

    res.status(500).json({
      error: "Error al listar matrículas",
      detail: err.message,
    });
  }
});

profRouter.post("/subjects/:id/enrollments", async (req, res) => {
  try {
    const { studentEmail, studentId } = req.body || {};

    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    let student = null;

    if (studentId) {
      student = await getById("users", studentId);
    }

    if (!student && studentEmail) {
      student = await findOne("users", "email", String(studentEmail).toLowerCase());
    }

    if (!student) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const role = student.role || student.rol;

    if (role !== "student") {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const exists = await queryWhere("enrollments", "subject_id", "==", req.params.id);

    const dup = (exists || []).some(
      (x) => String(x.student_id ?? x.studentId) === String(student.id)
    );

    if (dup) {
      return res.status(409).json({ error: "Ya está matriculado" });
    }

    const enrollmentId = nanoid();
    const nowISO = new Date().toISOString();

    await upsert("enrollments", enrollmentId, {
      subject_id: req.params.id,
      student_id: student.id,
      created_at: nowISO,
    });

    const enrollment = await getById("enrollments", enrollmentId);

    res.status(201).json({ enrollment });
  } catch (err) {
    console.error("Error al matricular estudiante:", err);

    res.status(500).json({
      error: "Error al matricular estudiante",
      detail: err.message,
    });
  }
});

profRouter.delete("/subjects/:id/enrollments/:enrollmentId", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    await remove("enrollments", req.params.enrollmentId);

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar matrícula:", err);

    res.status(500).json({
      error: "Error al eliminar matrícula",
      detail: err.message,
    });
  }
});

// =========================
// ATTENDANCE
// =========================
profRouter.get("/subjects/:id/attendance", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const { from, to, onlyPending } = req.query;

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    let items = await queryWhere("attendance", "subject_id", "==", req.params.id);

    items = items || [];

    if (onlyPending === "true") {
      items = items.filter(
        (a) => (a.approval_status || a.approvalStatus) === "pending"
      );
    }

    if (fromDate) {
      items = items.filter((a) => new Date(a.timestamp) >= fromDate);
    }

    if (toDate) {
      items = items.filter((a) => new Date(a.timestamp) <= toDate);
    }

    const enriched = await Promise.all(
      items.map(async (a) => {
        const studentId = a.studentId || a.student_id;

        const [rows] = await pool.query(
          `SELECT id, name, lastname, email, student_code
           FROM users
           WHERE id = ?
           LIMIT 1`,
          [studentId]
        );

        const st = rows[0] || null;

        let finalTs = a.timestamp;

        if (finalTs instanceof Date) {
          const pad = (n) => String(n).padStart(2, "0");

          finalTs =
            finalTs.getFullYear() +
            "-" +
            pad(finalTs.getMonth() + 1) +
            "-" +
            pad(finalTs.getDate()) +
            "T" +
            pad(finalTs.getHours()) +
            ":" +
            pad(finalTs.getMinutes()) +
            ":" +
            pad(finalTs.getSeconds());
        }

        return {
          id: a.id,
          subjectId: a.subjectId || a.subject_id,
          studentId,
          timestamp: finalTs,
          method: a.method,
          status: a.status,
          approvalStatus: a.approval_status || a.approvalStatus,
          sessionKey: a.session_key || a.sessionKey,
          createdAt: a.createdAt || a.created_at,
          student: st
            ? {
                id: st.id,
                name: st.name,
                lastname: st.lastname || "",
                email: st.email,
                studentCode: st.student_code || "",
              }
            : null,
        };
      })
    );

    res.json({ attendance: enriched });
  } catch (err) {
    console.error("Error al listar asistencia:", err);

    res.status(500).json({
      error: "Error al listar asistencia",
      detail: err.message,
    });
  }
});

profRouter.delete("/subjects/:id/attendance/:attendanceId", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const row = await getById("attendance", req.params.attendanceId);

    if (!row) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    await remove("attendance", req.params.attendanceId);

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar asistencia:", err);

    res.status(500).json({
      error: "Error al eliminar asistencia",
      detail: err.message,
    });
  }
});

profRouter.put("/subjects/:id/attendance/:attendanceId/timestamp", async (req, res) => {
  try {
    const { timestamp } = req.body || {};

    if (!timestamp) {
      return res.status(400).json({ error: "timestamp requerido" });
    }

    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const parsed = new Date(timestamp);

    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "timestamp inválido" });
    }

    const [result] = await pool.query(
      `UPDATE attendance
       SET timestamp = ?
       WHERE id = ?
       AND subject_id = ?`,
      [parsed.toISOString().replace("T", " ").split(".")[0], req.params.attendanceId, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al actualizar hora de asistencia:", err);

    res.status(500).json({
      error: "Error al actualizar hora de asistencia",
      detail: err.message,
    });
  }
});

async function buildSessionForNow(subjectId, tsISO) {
  const subjectSchedules = await queryWhere("schedules", "subject_id", "==", subjectId);

  const setRow = await getById("settings", subjectId);

  const graceMinutes = setRow
    ? Number(setRow.grace_minutes ?? setRow.graceMinutes ?? 10)
    : 10;

  let status = null;
  let matchedSc = null;

  for (const sc of subjectSchedules || []) {
    const schedule = {
      dayOfWeek: Number(sc.day_of_week ?? sc.dayOfWeek),
      startTime: sc.start_time ?? sc.startTime,
      endTime: sc.end_time ?? sc.endTime,
    };

    const m = matchSchedule({
      schedule,
      timestampISO: tsISO,
      graceMinutes,
    });

    if (m.match) {
      status = m.status;
      matchedSc = schedule;
      break;
    }
  }

  if (!status || !matchedSc) return null;

  const todayKey = dateKeyInTZ(new Date(tsISO));
  const sessionKey = `${subjectId}|${todayKey}|${matchedSc.dayOfWeek}|${matchedSc.startTime}-${matchedSc.endTime}`;

  return {
    status,
    matchedSc,
    sessionKey,
  };
}

// =========================
// REGISTRO MANUAL
// =========================
profRouter.post("/subjects/:id/attendance/manual", async (req, res) => {
  try {
    const { studentId, status, date, scheduleId, timestamp, time } = req.body || {};

    if (!studentId) {
      return res.status(400).json({ error: "studentId requerido" });
    }

    if (!scheduleId) {
      return res.status(400).json({ error: "scheduleId requerido" });
    }

    if (!date) {
      return res.status(400).json({ error: "date requerido" });
    }

    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const student = await getById("users", studentId);
    const role = student?.role || student?.rol;

    if (!student || role !== "student") {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const subjectId = req.params.id;

    const sc = await getById("schedules", scheduleId);

    if (!sc || String(sc.subject_id || sc.subjectId) !== String(subjectId)) {
      return res.status(404).json({
        error: "Horario no encontrado para esta materia",
      });
    }

    const schedule = {
      dayOfWeek: Number(sc.day_of_week ?? sc.dayOfWeek),
      startTime: sc.start_time ?? sc.startTime,
      endTime: sc.end_time ?? sc.endTime,
    };

    const selectedDay = dayOfWeekFromDateString(date);

    if (selectedDay === null) {
      return res.status(400).json({
        error: "Fecha inválida. Usa formato YYYY-MM-DD.",
      });
    }

    if (selectedDay !== schedule.dayOfWeek) {
      return res.status(400).json({
        error: `La fecha seleccionada es ${DAYS_ES[selectedDay]}, pero el horario pertenece a ${DAYS_ES[schedule.dayOfWeek]}.`,
      });
    }

    const finalTimestamp = normalizeTimestamp({
      date,
      time,
      fallbackTime: schedule.startTime,
      timestamp,
    });

    const finalDate = finalTimestamp.slice(0, 10);
    const finalTime = finalTimestamp.slice(11, 16);

    if (finalDate !== date) {
      return res.status(400).json({
        error: "La fecha del timestamp no coincide con la fecha seleccionada.",
      });
    }

    if (!isHHMMInsideSchedule(finalTime, schedule.startTime, schedule.endTime)) {
      return res.status(400).json({
        error: `La hora seleccionada está fuera del rango del horario (${schedule.startTime} - ${schedule.endTime}).`,
      });
    }

    const sessionKey = `${subjectId}|${date}|${schedule.dayOfWeek}|${schedule.startTime}-${schedule.endTime}`;

    const exists = await alreadyMarked(subjectId, studentId, sessionKey);

    const attendanceData = {
      subjectId,
      studentId,
      timestamp: finalTimestamp,
      method: "manual",
      status: status || "present",
      approvalStatus: "approved",
      sessionKey,
      createdAt: new Date().toLocaleString("sv-SE"),
    };

    const attendanceId = `${studentId}_${sessionKey}`.replace(/[|:\s]/g, "_");

    await upsert("attendance", attendanceId, attendanceData);

    if (!exists) {
      const subject = await getById("subjects", subjectId);
      const subjectName = subject?.name || "";

      const emailTimestamp = finalTimestamp.includes(" ")
        ? finalTimestamp.replace(" ", "T")
        : finalTimestamp;

      try {
        await sendAttendanceEmail({
          to: student.email,
          studentName: normalizeUserName(student),
          subjectName,
          status: status || "present",
          timestampISO: emailTimestamp,
        });
      } catch (error) {
        console.error("❌ Error enviando correo (manual):", error);
      }
    }

    const saved = await getById("attendance", attendanceId);

    return res.status(exists ? 200 : 201).json({
      ok: true,
      message: exists
        ? "Asistencia actualizada correctamente."
        : "Asistencia registrada correctamente.",
      attendance: saved,
    });
  } catch (error) {
    console.error("Error en registro manual:", error);

    return res.status(500).json({
      error: "Error en registro manual",
      detail: error.message,
    });
  }
});

// =========================
// SCAN MARK
// =========================
profRouter.post("/subjects/:id/attendance/scan", async (req, res) => {
  try {
    const { faceId, timestamp } = req.body || {};

    if (!faceId) {
      return res.status(400).json({ error: "faceId requerido" });
    }

    const ts = timestamp || new Date().toISOString();

    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const subjectId = req.params.id;

    const subjectSchedules = await queryWhere("schedules", "subject_id", "==", subjectId);

    const setRow = await getById("settings", subjectId);

    const settings = setRow
      ? {
          graceMinutes: setRow.grace_minutes ?? setRow.graceMinutes ?? 10,
        }
      : {
          graceMinutes: 10,
        };

    let status = null;
    let matchedSc = null;

    for (const sc of subjectSchedules || []) {
      const schedule = {
        dayOfWeek: Number(sc.day_of_week ?? sc.dayOfWeek),
        startTime: sc.start_time ?? sc.startTime,
        endTime: sc.end_time ?? sc.endTime,
      };

      const m = matchSchedule({
        schedule,
        timestampISO: ts,
        graceMinutes: settings.graceMinutes,
      });

      if (m.match) {
        status = m.status;
        matchedSc = schedule;
        break;
      }
    }

    if (!status || !matchedSc) {
      return res.status(202).json({
        ok: true,
        message: "No hay clase en curso para esta materia.",
      });
    }

    const student =
      (await findOne("users", "face_id", String(faceId).trim())) ||
      (await findOne("users", "faceId", String(faceId).trim()));

    if (!student) {
      return res.status(404).json({ error: "No existe estudiante con ese faceId" });
    }

    const enr = await queryWhere("enrollments", "subject_id", "==", subjectId);

    const enrolled = (enr || []).some(
      (x) => String(x.student_id ?? x.studentId) === String(student.id)
    );

    if (!enrolled) {
      return res.status(403).json({
        error: "El estudiante no está matriculado en esta materia",
      });
    }

    const todayKey = dateKeyInTZ(new Date(ts));
    const sessionKey = `${subjectId}|${todayKey}|${matchedSc.dayOfWeek}|${matchedSc.startTime}-${matchedSc.endTime}`;

    const attRows = await queryWhere("attendance", "subject_id", "==", subjectId);

    const already = (attRows || []).some(
      (a) =>
        String(a.student_id ?? a.studentId) === String(student.id) &&
        String(a.session_key || a.sessionKey) === sessionKey
    );

    if (already) {
      return res.json({
        ok: true,
        alreadyMarked: true,
        message: "El estudiante ya fue registrado en esta clase.",
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
        },
      });
    }

    const attendanceId = `${student.id}_${sessionKey}`.replace(/[|:\s]/g, "_");
    const nowLocal = new Date().toLocaleString("sv-SE");

    await upsert("attendance", attendanceId, {
      subjectId,
      studentId: student.id,
      timestamp: ts,
      method: "prof_device",
      status,
      approvalStatus: "approved",
      sessionKey,
      createdAt: nowLocal,
    });

    const subject = await getById("subjects", subjectId);
    const subjectName = subject?.name || "";

    const emailTs = String(ts).includes("Z") ? ts : String(ts).replace(" ", "T");

    try {
      await sendAttendanceEmail({
        to: student.email,
        studentName: normalizeUserName(student),
        subjectName,
        status,
        timestampISO: emailTs,
      });
    } catch (error) {
      console.error("❌ Error enviando correo (scan):", error);
    }

    const saved = await getById("attendance", attendanceId);

    return res.status(201).json({
      ok: true,
      alreadyMarked: false,
      stored: saved,
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
      },
    });
  } catch (err) {
    console.error("Error en scan:", err);

    return res.status(500).json({
      error: "Error en scan",
      detail: err.message,
    });
  }
});

// =========================
// APPROVE / REJECT
// =========================
profRouter.post("/subjects/:id/attendance/:attendanceId/approve", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    await upsert("attendance", req.params.attendanceId, {
      approval_status: "approved",
      approved_at: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al aprobar asistencia:", err);

    res.status(500).json({
      error: "Error al aprobar asistencia",
      detail: err.message,
    });
  }
});

profRouter.post("/subjects/:id/attendance/:attendanceId/reject", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    await upsert("attendance", req.params.attendanceId, {
      approval_status: "rejected",
      rejected_at: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al rechazar asistencia:", err);

    res.status(500).json({
      error: "Error al rechazar asistencia",
      detail: err.message,
    });
  }
});

// =========================
// EXPORT EXCEL
// =========================
profRouter.get("/subjects/:id/attendance/export", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const { from, to } = req.query;

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    const subjectId = req.params.id;

    const enrollmentsRaw = await queryWhere("enrollments", "subject_id", "==", subjectId);
    const enrollments = enrollmentsRaw || [];

    let items = await queryWhere("attendance", "subject_id", "==", subjectId);

    items = items || [];

    items = items.filter(
      (a) => (a.approval_status || a.approvalStatus) !== "rejected"
    );

    if (fromDate) {
      items = items.filter((a) => new Date(a.timestamp) >= fromDate);
    }

    if (toDate) {
      items = items.filter((a) => new Date(a.timestamp) <= toDate);
    }

    const byStudent = new Map();

    for (const a of items) {
      const sid = a.student_id || a.studentId;

      if (sid) {
        byStudent.set(String(sid), a);
      }
    }

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

    for (const e of enrollments) {
      const studentId = e.student_id || e.studentId;

      if (!studentId) continue;

      const st = await getById("users", studentId);
      const a = byStudent.get(String(studentId));

      if (a) {
        ws.addRow({
          studentCode: st?.studentCode || st?.student_code || "",
          student: normalizeUserName(st) || "N/A",
          email: st?.email || "N/A",
          timestamp: a.timestamp,
          status:
            a.status === "present"
              ? "Presente"
              : a.status === "late"
              ? "Tarde"
              : a.status,
          method:
            a.method === "prof_device"
              ? "Sistema"
              : a.method === "manual"
              ? "Manual"
              : a.method,
          approvalStatus: a.approval_status || a.approvalStatus,
        });
      } else {
        ws.addRow({
          studentCode: st?.studentCode || st?.student_code || "",
          student: normalizeUserName(st) || "N/A",
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
  } catch (err) {
    console.error("Error al exportar asistencia:", err);

    res.status(500).json({
      error: "Error al exportar asistencia",
      detail: err.message,
    });
  }
});

// =========================
// STATS
// =========================
profRouter.get("/subjects/:id/attendance/stats", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from y to son requeridos" });
    }

    const subjectId = req.params.id;

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59`);

    const schedules = await queryWhere("schedules", "subject_id", "==", subjectId);

    const expectedSessions = new Set();

    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const dateKey = dateKeyInTZ(new Date(d));

      for (const sc of schedules || []) {
        const dow = Number(sc.day_of_week ?? sc.dayOfWeek);

        if (dow === day) {
          const start = sc.start_time ?? sc.startTime;
          const end = sc.end_time ?? sc.endTime;

          expectedSessions.add(`${subjectId}|${dateKey}|${dow}|${start}-${end}`);
        }
      }
    }

    const totalClasses = expectedSessions.size;

    let attendance = await queryWhere("attendance", "subject_id", "==", subjectId);

    attendance = (attendance || []).filter((a) => {
      if ((a.approval_status || a.approvalStatus) === "rejected") return false;

      const t = new Date(a.timestamp);

      return t >= fromDate && t <= toDate;
    });

    const enrollments = await queryWhere("enrollments", "subject_id", "==", subjectId);

    const result = [];

    for (const e of enrollments || []) {
      const studentId = e.student_id ?? e.studentId;
      const student = await getById("users", studentId);

      const attendedSessions = new Set(
        attendance
          .filter((a) => String(a.student_id ?? a.studentId) === String(studentId))
          .map((a) => a.session_key ?? a.sessionKey)
      ).size;

      const percent = totalClasses
        ? Number(((attendedSessions / totalClasses) * 100).toFixed(1))
        : 0;

      result.push({
        studentId,
        name: student?.name || "N/A",
        lastname: student?.lastname || student?.lastName || student?.last_name || "",
        fullName: normalizeUserName(student) || "N/A",
        total: totalClasses,
        attended: attendedSessions,
        percent,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Error al generar estadísticas:", err);

    res.status(500).json({
      error: "Error al generar estadísticas",
      detail: err.message,
    });
  }
});

// =========================
// EVIDENCIAS TAPO
// =========================
profRouter.get("/subjects/:id/evidence", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);

    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    const [rows] = await pool.query(
      `SELECT id, subject_id, session_id, shot_type, taken_at, file_name, file_path, expires_at, created_at
       FROM attendance_evidence
       WHERE subject_id = ?
       ORDER BY taken_at DESC, id DESC`,
      [req.params.id]
    );

    const evidence = (rows || []).map((ev) => ({
      id: ev.id,
      subject_id: ev.subject_id,
      session_id: ev.session_id,
      shot_type: ev.shot_type,
      taken_at: ev.taken_at,
      file_name: ev.file_name,
      file_path: ev.file_path,
      expires_at: ev.expires_at,
      created_at: ev.created_at,
      viewUrl: `/api/prof/evidence/${ev.id}/image${
        token ? `?token=${encodeURIComponent(token)}` : ""
      }`,
    }));

    res.json({
      ok: true,
      evidence,
    });
  } catch (err) {
    console.error("Error al listar evidencias:", err);

    res.status(500).json({
      ok: false,
      error: "Error al listar evidencias",
      detail: err.message,
    });
  }
});