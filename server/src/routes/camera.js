import { Router } from "express";
import { nanoid } from "nanoid";
import { requireCameraKey } from "../middleware/requireCameraKey.js";
import { matchSchedule } from "../utils/time.js";
import { getById, findOne, listAll, queryWhere, upsert } from "../utils/mysqlDb.js";

export const cameraRouter = Router();

/**
 * Endpoint para el "sistema de cámara".
 * Recibe un evento de entrada (rostro reconocido) y el servidor decide:
 * - Qué materia está en curso (según horario)
 * - Si el estudiante está matriculado o no
 * - Si queda como presente / tarde / pendiente (si no está matriculado)
 *
 * Firestore colecciones usadas:
 * - users
 * - schedules
 * - settings
 * - enrollments
 * - attendance
 * - attendanceEvents
 */
cameraRouter.post("/event", requireCameraKey(), async (req, res) => {
  try {
    const { faceId, studentId, timestamp } = req.body || {};
    const ts = timestamp || new Date().toISOString();

    if (!faceId && !studentId) {
      return res.status(400).json({ error: "Se requiere faceId o studentId" });
    }

    // 1) Buscar estudiante
    const student = studentId
      ? await getById("users", studentId)
      : await findOne("users", "faceId", faceId);

    if (!student || student.role !== "student") {
      // Evento: rostro desconocido
      const eventId = nanoid();
      await upsert("attendanceEvents", eventId, {
        kind: "unknown_face",
        faceId: faceId || null,
        studentId: studentId || null,
        timestamp: ts,
        createdAt: new Date().toISOString(),
      });

      return res.status(202).json({
        ok: true,
        message: "Rostro no registrado (evento guardado)",
      });
    }

    // 2) Traer horarios y settings desde Firestore
    const schedules = await listAll("schedules"); // [{id, subjectId, ...}]
    const settingsAll = await listAll("settings"); // [{id, subjectId, graceMinutes, ...}]

    // Mapa rápido subjectId -> settings
    const settingsMap = new Map(
      settingsAll
        .filter(s => s && s.subjectId)
        .map(s => [s.subjectId, s])
    );

    // 3) Buscar clases que coincidan con el horario
    const candidates = [];
    for (const schedule of schedules) {
      if (!schedule?.subjectId) continue;

      const st = settingsMap.get(schedule.subjectId) || { graceMinutes: 10 };
      const m = matchSchedule({
        schedule,
        timestampISO: ts,
        graceMinutes: Number(st.graceMinutes ?? 10),
      });

      if (m.match) candidates.push({ schedule, status: m.status });
    }

    if (candidates.length === 0) {
      // Evento: no hay clase en curso
      const eventId = nanoid();
      await upsert("attendanceEvents", eventId, {
        kind: "no_schedule",
        studentId: student.id,
        faceId: student.faceId || null,
        timestamp: ts,
        createdAt: new Date().toISOString(),
      });

      return res.status(202).json({
        ok: true,
        message: "No hay clase en curso (evento guardado)",
      });
    }

    // 4) Si hay varias, tomamos la primera (puedes mejorar después)
    const chosen = candidates[0];
    const subjectId = chosen.schedule.subjectId;

    // 5) Ver matrícula del estudiante en esa materia
    //    (más eficiente: solo traemos enrollments de esa materia)
    const enrolledRows = await queryWhere("enrollments", "subjectId", "==", subjectId);
    const isEnrolled = enrolledRows.some(
      e => e.studentId === student.id && e.subjectId === subjectId
    );

    // 6) Guardar asistencia en Firestore
    const attendanceId = nanoid();
    const attendance = {
      subjectId,
      studentId: student.id,
      timestamp: ts,
      method: "camera",
      status: chosen.status, // present|late
      approvalStatus: isEnrolled ? "approved" : "pending",
      createdAt: new Date().toISOString(),
    };

    await upsert("attendance", attendanceId, attendance);

    return res.status(201).json({
      ok: true,
      subjectId,
      studentId: student.id,
      enrollment: isEnrolled ? "enrolled" : "not_enrolled",
      stored: { id: attendanceId, ...attendance },
    });
  } catch (err) {
    console.error("camera/event error:", err);
    return res.status(500).json({
      error: "Error interno en /camera/event",
      detail: err?.message || String(err),
    });
  }
});
