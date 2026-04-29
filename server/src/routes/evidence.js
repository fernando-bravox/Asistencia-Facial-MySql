// server/src/evidence.js
import express from "express";
import { pool } from "../utils/mysqlPool.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const evidenceRouter = express.Router();
function labelShotType(type) {
  if (type === "EARLY_5") return "Inicio de clase";
  if (type === "GRACE_END") return "Minutos de límite / gracia";
  if (type === "MID_30") return "Seguimiento de clase";
  return "Evidencia de clase";
}

evidenceRouter.get(
  "/prof/subjects/:subjectId/evidence-all",
  requireAuth,
  async (req, res) => {
    try {
      // OJO: tu subject_id es texto tipo subJAz..., no número
      const subjectId = String(req.params.subjectId || "").trim();

      const [rows] = await pool.query(
        `SELECT
          id,
          subject_id,
          session_id,
          shot_type,
          taken_at,
          file_name,
          expires_at,
          created_at
        FROM attendance_evidence
        WHERE subject_id = ?
        ORDER BY COALESCE(taken_at, created_at) DESC, id DESC`,
        [subjectId]
      );

      const token = req.headers.authorization?.replace("Bearer ", "") || null;

      const out = rows.map((r) => {
        const imageUrl = token
          ? `/api/prof/evidence/${r.id}/image?token=${encodeURIComponent(token)}`
          : `/api/prof/evidence/${r.id}/image`;

        return {
          id: r.id,
          subjectId: r.subject_id,
          sessionId: r.session_id,

          shotType: r.shot_type,
          shotTypeLabel: labelShotType(r.shot_type),

          takenAt: r.taken_at,
          createdAt: r.created_at,
          expiresAt: r.expires_at,

          fileName: r.file_name,
          expired: r.expires_at ? new Date(r.expires_at) < new Date() : false,

          imageUrl
        };
      });

      res.json({
        ok: true,
        evidence: out
      });
    } catch (err) {
      console.error("Error cargando evidencias generales:", err);
      res.status(500).json({
        ok: false,
        message: "No se pudieron cargar las evidencias."
      });
    }
  }
);

evidenceRouter.get(
  "/prof/subjects/:subjectId/sessions/:sessionId/evidence",
  requireAuth,
  async (req, res) => {
    const subjectId = Number(req.params.subjectId);
    const sessionId = Number(req.params.sessionId);

    const [rows] = await pool.query(
      `SELECT
        id,
        shot_type,
        taken_at,
        file_name,
        expires_at
       FROM attendance_evidence
       WHERE subject_id=? AND session_id=?
       ORDER BY taken_at ASC`,
      [subjectId, sessionId]
    );

    const token = req.headers.authorization?.replace("Bearer ", "") || null;

    const out = rows.map((r) => ({
      id: r.id,
      shot_type: r.shot_type,
      taken_at: r.taken_at,
      file_name: r.file_name,
      expires_at: r.expires_at,
      viewUrl: token
        ? `/api/prof/evidence/${r.id}/image?token=${encodeURIComponent(token)}`
        : `/api/prof/evidence/${r.id}/image`,
    }));

    res.json({ ok: true, evidence: out });
  }
);