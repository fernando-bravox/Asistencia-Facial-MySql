import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { listAll, queryWhere } from "../utils/mysqlDb.js";

export const studentRouter = Router();
studentRouter.use(requireAuth(), requireRole("student"));

// Mis materias (según enrollments)
studentRouter.get("/subjects", async (req, res) => {
  const myEnrollments = await queryWhere("enrollments", "studentId", "==", req.user.id);
  const subjectsAll = await listAll("subjects");
  const schedulesAll = await listAll("schedules");

  const subjects = myEnrollments
    .map(e => subjectsAll.find(s => s.id === e.subjectId))
    .filter(Boolean)
    .map(s => {
      const schedules = schedulesAll.filter(sc => sc.subjectId === s.id);
      return { ...s, schedules };
    });

  res.json({ subjects });
});

studentRouter.get("/subjects/:id/attendance", async (req, res) => {
  const subjectId = req.params.id;

  const myEnrollments = await queryWhere("enrollments", "studentId", "==", req.user.id);
  const enrolled = myEnrollments.some(e => e.subjectId === subjectId);
  if (!enrolled) return res.status(403).json({ error: "No estás matriculado en esta materia" });

  const items = await queryWhere("attendance", "studentId", "==", req.user.id);

  const filtered = items
    .filter(a => a.subjectId === subjectId && a.approvalStatus !== "rejected")
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({ attendance: filtered });
});
