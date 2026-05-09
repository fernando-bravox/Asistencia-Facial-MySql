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

function getApiPrefix(req) {
  const originalUrl = req.originalUrl || "";

  // Si tu app está entrando por /backend/api
  if (originalUrl.includes("/backend/api/")) {
    return "/backend/api";
  }

  // Si tu app está entrando directamente por /api
  if (originalUrl.includes("/api/")) {
    return "/api";
  }

  // Respaldo
  return "/api";
}

function buildImageUrl(req, evidenceId) {
  const token = req.headers.authorization?.replace("Bearer ", "") || null;
  const apiPrefix = getApiPrefix(req);

  return token
    ? `${apiPrefix}/prof/evidence/${evidenceId}/image?token=${encodeURIComponent(token)}`
    : `${apiPrefix}/prof/evidence/${evidenceId}/image`;
}

function mapEvidenceRow(req, r) {
  const imageUrl = buildImageUrl(req, r.id);

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

    // Dejo los dos nombres por compatibilidad con tu frontend
    imageUrl,
    viewUrl: imageUrl,

    // También dejo estos nombres por si alguna pantalla usa snake_case
    shot_type: r.shot_type,
    taken_at: r.taken_at,
    file_name: r.file_name,
    expires_at: r.expires_at,
  };
}

// =====================================================
// TODAS LAS EVIDENCIAS DE UNA MATERIA
// Ruta principal que ya usabas en tu proyecto
// =====================================================
evidenceRouter.get(
  "/prof/subjects/:subjectId/evidence-all",
  requireAuth(),
  async (req, res) => {
    try {
      // Tu subject_id es texto tipo subJAz..., no número
      const subjectId = String(req.params.subjectId || "").trim();

      if (!subjectId) {
        return res.status(400).json({
          ok: false,
          message: "subjectId inválido.",
        });
      }

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

      const out = rows.map((r) => mapEvidenceRow(req, r));

      return res.json({
        ok: true,
        evidence: out,
      });
    } catch (err) {
      console.error("Error cargando evidencias generales:", err);

      return res.status(500).json({
        ok: false,
        message: "No se pudieron cargar las evidencias.",
        detail: err?.message || String(err),
      });
    }
  }
);

// =====================================================
// TODAS LAS EVIDENCIAS DE UNA MATERIA
// Ruta adicional compatible con el archivo de tu amigo
// =====================================================
evidenceRouter.get(
  "/prof/subjects/:subjectId/evidence",
  requireAuth(),
  async (req, res) => {
    try {
      const subjectId = String(req.params.subjectId || "").trim();

      if (!subjectId) {
        return res.status(400).json({
          ok: false,
          message: "subjectId inválido.",
        });
      }

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

      const out = rows.map((r) => mapEvidenceRow(req, r));

      return res.json({
        ok: true,
        evidence: out,
      });
    } catch (err) {
      console.error("Error cargando evidencias por materia:", err);

      return res.status(500).json({
        ok: false,
        message: "No se pudieron cargar las evidencias.",
        detail: err?.message || String(err),
      });
    }
  }
);

// =====================================================
// EVIDENCIAS DE UNA SESIÓN ESPECÍFICA
// =====================================================
evidenceRouter.get(
  "/prof/subjects/:subjectId/sessions/:sessionId/evidence",
  requireAuth(),
  async (req, res) => {
    try {
      // Se manejan como texto porque tus IDs no siempre son numéricos
      const subjectId = String(req.params.subjectId || "").trim();
      const sessionId = String(req.params.sessionId || "").trim();

      if (!subjectId || !sessionId) {
        return res.status(400).json({
          ok: false,
          message: "subjectId o sessionId inválido.",
        });
      }

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
        WHERE subject_id = ? AND session_id = ?
        ORDER BY COALESCE(taken_at, created_at) ASC, id ASC`,
        [subjectId, sessionId]
      );

      const out = rows.map((r) => mapEvidenceRow(req, r));

      return res.json({
        ok: true,
        evidence: out,
      });
    } catch (err) {
      console.error("Error cargando evidencias por sesión:", err);

      return res.status(500).json({
        ok: false,
        message: "No se pudieron cargar las evidencias de la sesión.",
        detail: err?.message || String(err),
      });
    }
  }
);