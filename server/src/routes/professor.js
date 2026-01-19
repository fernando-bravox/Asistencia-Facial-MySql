import { Router } from "express";
import { nanoid } from "nanoid";
import ExcelJS from "exceljs";
import { sendAttendanceEmail } from "../utils/mailer.js";

import { spawn } from "child_process";


import { requireAuth, requireRole } from "../middleware/requireAuth.js";

import { matchSchedule } from "../utils/time.js";

// ✅ Firestore helpers (para traer estudiantes reales)
import { queryWhere, findOne, getById, upsert, remove } from "../utils/mysqlDb.js";

export const profRouter = Router();
profRouter.use(requireAuth(), requireRole("professor"));



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
  if (subject.professorId !== professorId) return { error: "No eres dueño de esta materia", status: 403 };
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
// SUBJECTS (Firestore)
// =========================
profRouter.get("/subjects", async (req, res) => {
  try {
    // ✅ ordenado por createdAt (requiere índice compuesto)
    const snap = await db
      .collection("subjects")
      .where("professorId", "==", req.user.id)
      .orderBy("createdAt", "desc")
      .get();

    const subjects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

    const subject = {
      name: String(name).trim(),
      code, // ✅ automático
      room: room ? String(room).trim() : "",
      professorId: req.user.id,
      createdAt: new Date().toISOString(),
    };

    await db.collection("subjects").doc(subjectId).set(subject);

    // ✅ settings por defecto
    await db.collection("settings").doc(subjectId).set({
      subjectId,
      graceMinutes: 10,
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({ subject: { id: subjectId, ...subject } });
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

    await db.collection("subjects").doc(req.params.id).update(patch);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

profRouter.delete("/subjects/:id", async (req, res) => {
  try {
    const check = await ensureSubjectOwner(req.params.id, req.user.id);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const subjectId = req.params.id;

    // ✅ borrar cascada (colecciones relacionadas)
    const batches = [];
    let batch = db.batch();
    let ops = 0;

    async function delWhere(col, field, value) {
      const snap = await db.collection(col).where(field, "==", value).get();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
        ops++;
        if (ops >= 450) {
          batches.push(batch.commit());
          batch = db.batch();
          ops = 0;
        }
      }
    }

    await delWhere("schedules", "subjectId", subjectId);
    await delWhere("enrollments", "subjectId", subjectId);
    await delWhere("attendance", "subjectId", subjectId);

    // settings doc tiene id = subjectId
    batch.delete(db.collection("settings").doc(subjectId));
    ops++;

    // subject doc
    batch.delete(db.collection("subjects").doc(subjectId));
    ops++;

    batches.push(batch.commit());
    await Promise.all(batches);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// SCHEDULES (Firestore)
// =========================
profRouter.get("/subjects/:id/schedules", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const snap = await db.collection("schedules").where("subjectId", "==", req.params.id).get();
  const schedules = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  res.json({ schedules });
});

profRouter.post("/subjects/:id/schedules", async (req, res) => {
  const { dayOfWeek, startTime, endTime } = req.body || {};
  if (dayOfWeek === undefined || !startTime || !endTime) return res.status(400).json({ error: "Faltan campos" });

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const scheduleId = nanoid();
  const schedule = {
    subjectId: req.params.id,
    dayOfWeek: Number(dayOfWeek),
    startTime,
    endTime,
    createdAt: new Date().toISOString(),
  };

  await db.collection("schedules").doc(scheduleId).set(schedule);
  res.status(201).json({ schedule: { id: scheduleId, ...schedule } });
});

profRouter.delete("/subjects/:id/schedules/:scheduleId", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await db.collection("schedules").doc(req.params.scheduleId).delete();
  res.json({ ok: true });
});

// =========================
// SETTINGS (Firestore)
// =========================
profRouter.get("/subjects/:id/settings", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const snap = await db.collection("settings").doc(req.params.id).get();
  const settings = snap.exists ? snap.data() : { graceMinutes: 10 };
  res.json({ settings });
});

profRouter.put("/subjects/:id/settings", async (req, res) => {
  const { graceMinutes } = req.body || {};

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await db.collection("settings").doc(req.params.id).set(
    {
      subjectId: req.params.id,
      graceMinutes: Number(graceMinutes || 10),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  res.json({ ok: true });
});

// =========================
// ENROLLMENTS (Firestore + Students Firestore)
// =========================
profRouter.get("/subjects/:id/enrollments", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const snap = await db.collection("enrollments").where("subjectId", "==", req.params.id).get();
  const enrollmentsRaw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const enrollments = await Promise.all(
    enrollmentsRaw.map(async (e) => {
      const st = await getById("users", e.studentId);
      return {
        ...e,
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

  if (!student || student.role !== "student") return res.status(404).json({ error: "Estudiante no encontrado" });

  // ✅ validar duplicado
  const existsSnap = await db
    .collection("enrollments")
    .where("subjectId", "==", req.params.id)
    .where("studentId", "==", student.id)
    .limit(1)
    .get();

  if (!existsSnap.empty) return res.status(409).json({ error: "Ya está matriculado" });

  const enrollmentId = nanoid();
  const enr = {
    subjectId: req.params.id,
    studentId: student.id,
    createdAt: new Date().toISOString(),
  };

  await db.collection("enrollments").doc(enrollmentId).set(enr);
  res.status(201).json({ enrollment: { id: enrollmentId, ...enr } });
});

profRouter.delete("/subjects/:id/enrollments/:enrollmentId", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await db.collection("enrollments").doc(req.params.enrollmentId).delete();
  res.json({ ok: true });
});

// =========================
// ATTENDANCE (Firestore) - para que scan funcione con schedules/settings/enrollments Firestore
// =========================
profRouter.get("/subjects/:id/attendance", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const { from, to, onlyPending } = req.query;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  let q = db.collection("attendance").where("subjectId", "==", req.params.id);

  // (filtros en memoria por simplicidad)
  const snap = await q.get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (onlyPending === "true") items = items.filter((a) => a.approvalStatus === "pending");
  if (fromDate) items = items.filter((a) => new Date(a.timestamp) >= fromDate);
  if (toDate) items = items.filter((a) => new Date(a.timestamp) <= toDate);

  const enriched = await Promise.all(
    items.map(async (a) => {
      const st = await getById("users", a.studentId);
      return { ...a, student: st ? { id: st.id, name: st.name, email: st.email, studentCode: st.studentCode || "" } : null };
    })
  );

  res.json({ attendance: enriched });
});

profRouter.delete("/subjects/:id/attendance/:attendanceId", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const ref = db.collection("attendance").doc(req.params.attendanceId);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Registro no encontrado" });

  await ref.delete();
  res.json({ ok: true });
});

profRouter.put("/subjects/:id/attendance/:attendanceId/timestamp", async (req, res) => {
  const { timestamp } = req.body || {};
  if (!timestamp) return res.status(400).json({ error: "timestamp requerido" });

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const parsed = new Date(timestamp);
  if (isNaN(parsed.getTime())) return res.status(400).json({ error: "timestamp inválido" });

  await db.collection("attendance").doc(req.params.attendanceId).update({
    timestamp: parsed.toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.json({ ok: true });
});

profRouter.post("/subjects/:id/attendance/manual", async (req, res) => {
  const { studentId, status } = req.body || {};
  if (!studentId) return res.status(400).json({ error: "studentId requerido" });

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const student = await getById("users", studentId);
  if (!student || student.role !== "student") return res.status(404).json({ error: "Estudiante no encontrado" });

  const attendanceId = nanoid();
  const attendance = {
    subjectId: req.params.id,
    studentId,
    timestamp: new Date().toISOString(),
    method: "manual",
    status: status || "present",
    approvalStatus: "approved",
    createdAt: new Date().toISOString(),
  };

  await db.collection("attendance").doc(attendanceId).set(attendance);

try {
  const subjectSnap = await db.collection("subjects").doc(req.params.id).get(); // ✅ AQUÍ
  const subjectName = subjectSnap.exists ? (subjectSnap.data()?.name || "") : "";

  await sendAttendanceEmail({
    to: student.email,
    studentName: student.name,
    subjectName,
    status: attendance.status,
    timestampISO: attendance.createdAt,
  });

  console.log("✅ Correo enviado a:", student.email);
} catch (error) {
  console.error("❌ Error enviando correo de asistencia:", error); // mejor que solo error.message
}


  res.status(201).json({ attendance: { id: attendanceId, ...attendance } });
  
});

// Scan mark (profesor) ✅ con Firestore
profRouter.post("/subjects/:id/attendance/scan", async (req, res) => {
  const { faceId, timestamp } = req.body || {};
  if (!faceId) return res.status(400).json({ error: "faceId requerido" });

  const ts = timestamp || new Date().toISOString();

  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const subjectId = req.params.id;

  // schedules
  const schSnap = await db.collection("schedules").where("subjectId", "==", subjectId).get();
  const subjectSchedules = schSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // settings
  const setSnap = await db.collection("settings").doc(subjectId).get();
  const settings = setSnap.exists ? setSnap.data() : { graceMinutes: 10 };

  let status = null;
  let matchedSc = null;

  for (const sc of subjectSchedules) {
    const m = matchSchedule({ schedule: sc, timestampISO: ts, graceMinutes: settings.graceMinutes });
    if (m.match) {
      status = m.status;
      matchedSc = sc;
      break;
    }
  }

  if (!status || !matchedSc) {
    return res.status(202).json({ ok: true, message: "No hay clase en curso para esta materia." });
  }

  // buscar estudiante por faceId
  const student = await findOne("users", "faceId", String(faceId).trim());
  if (!student) return res.status(404).json({ error: "No existe estudiante con ese faceId" });

  // validar matrícula
  const enrSnap = await db
    .collection("enrollments")
    .where("subjectId", "==", subjectId)
    .where("studentId", "==", student.id)
    .limit(1)
    .get();

  if (enrSnap.empty) return res.status(403).json({ error: "El estudiante no está matriculado en esta materia" });

  // evitar duplicado por clase
  const todayKey = dateKeyInTZ(new Date(ts));
  const sessionKey = `${subjectId}|${todayKey}|${matchedSc.dayOfWeek}|${matchedSc.startTime}-${matchedSc.endTime}`;

  const dupSnap = await db
    .collection("attendance")
    .where("subjectId", "==", subjectId)
    .where("studentId", "==", student.id)
    .where("sessionKey", "==", sessionKey)
    .limit(1)
    .get();

  if (!dupSnap.empty) {
    return res.json({
      ok: true,
      alreadyMarked: true,
      message: "El estudiante ya fue registrado en esta clase.",
      student: { id: student.id, name: student.name, email: student.email },
    });
  }

const attendanceId = `${student.id}_${sessionKey}`.replace(/[|:\s]/g, "_");

const attendance = {
  subjectId,
  studentId: student.id,
  timestamp: ts,
  method: "prof_device",
  status,
  approvalStatus: "approved",
  sessionKey,
  createdAt: new Date().toISOString(),
};


  await db.collection("attendance").doc(attendanceId).set(attendance);
try {
  const subjectSnap = await db.collection("subjects").doc(subjectId).get();
  const subjectName = subjectSnap.exists ? (subjectSnap.data()?.name || "") : "";

  await sendAttendanceEmail({
    to: student.email,
    studentName: student.name,
    subjectName,
    status: attendance.status,
    timestampISO: attendance.createdAt,
  });

  console.log("✅ Correo enviado (scan) a:", student.email);
} catch (error) {
  console.error("❌ Error enviando correo (scan):", error);
}

  return res.status(201).json({
    ok: true,
    alreadyMarked: false,
    stored: { id: attendanceId, ...attendance },
    student: { id: student.id, name: student.name, email: student.email },
  });
});

// Approve / Reject
profRouter.post("/subjects/:id/attendance/:attendanceId/approve", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await db.collection("attendance").doc(req.params.attendanceId).update({
    approvalStatus: "approved",
    approvedAt: new Date().toISOString(),
  });

  res.json({ ok: true });
});

profRouter.post("/subjects/:id/attendance/:attendanceId/reject", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  await db.collection("attendance").doc(req.params.attendanceId).update({
    approvalStatus: "rejected",
    rejectedAt: new Date().toISOString(),
  });

  res.json({ ok: true });
});

// Export Excel
profRouter.get("/subjects/:id/attendance/export", async (req, res) => {
  const check = await ensureSubjectOwner(req.params.id, req.user.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const { from, to } = req.query;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const snap = await db.collection("attendance").where("subjectId", "==", req.params.id).get();
  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.approvalStatus !== "rejected");

  if (fromDate) items = items.filter((a) => new Date(a.timestamp) >= fromDate);
  if (toDate) items = items.filter((a) => new Date(a.timestamp) <= toDate);

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

  for (const a of items) {
    const st = await getById("users", a.studentId);
    ws.addRow({
      studentCode: st?.studentCode || "",
      student: st?.name || "N/A",
      email: st?.email || "N/A",
      timestamp: a.timestamp,
      status: a.status,
      method: a.method,
      approvalStatus: a.approvalStatus,
    });
  }

  ws.getRow(1).font = { bold: true };

  const fileBuffer = await wb.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="asistencia_${req.params.id}.xlsx"`);
  res.send(Buffer.from(fileBuffer));
});
