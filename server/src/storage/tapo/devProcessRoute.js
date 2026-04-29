// server/src/storage/tapo/devProcessRoute.js
import express from "express";
import { pool } from "../../utils/mysqlPool.js";
import { processEvidenceAndMark } from "./processAndMark.js";

export const tapoProcessDevRouter = express.Router();

// ✅ Procesa una evidencia específica por ID (MySQL)
// GET /api/dev/tapo/process-evidence?evidenceId=20
tapoProcessDevRouter.get("/dev/tapo/process-evidence", async (req, res) => {
  try {
    const evidenceId = Number(req.query.evidenceId || 0);
    if (!evidenceId) {
      return res.status(400).json({ ok: false, message: "Falta evidenceId" });
    }

    const result = await processEvidenceAndMark({ evidenceId });

    res.json({ ok: true, evidenceId, result });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// ✅ Procesa la última evidencia (opcionalmente por materia)
// GET /api/dev/tapo/process-last
// GET /api/dev/tapo/process-last?subjectId=oKqgXV-4hOU2axzb1xImR
tapoProcessDevRouter.get("/dev/tapo/process-last", async (req, res) => {
  try {
    const subjectId = req.query.subjectId ? String(req.query.subjectId) : "";

    const [rows] = await pool.query(
      `SELECT id
       FROM attendance_evidence
       ${subjectId ? "WHERE subject_id=?" : ""}
       ORDER BY taken_at DESC
       LIMIT 1`,
      subjectId ? [subjectId] : []
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, message: "No hay evidencias" });
    }

    const evidenceId = Number(rows[0].id);
    const result = await processEvidenceAndMark({ evidenceId });

    res.json({ ok: true, evidenceId, result });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});