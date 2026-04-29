// server/src/evidenceImage.js
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../utils/mysqlPool.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const evidenceImageRouter = express.Router();

evidenceImageRouter.get(
  "/prof/evidence/:id/image",
  requireAuth,
  async (req, res) => {
    const id = Number(req.params.id);

    const [rows] = await pool.query(
      `SELECT id, file_name, file_path
       FROM attendance_evidence
       WHERE id=? LIMIT 1`,
      [id]
    );

    const row = rows[0];
    if (!row) return res.status(404).json({ ok: false, message: "No existe evidencia." });

    const abs = path.resolve(row.file_path);
    const base = path.resolve(process.env.TAPO_STORAGE_DIR || "storage/tapo");

    if (!abs.startsWith(base)) {
      return res.status(403).json({ ok: false, message: "Ruta inválida." });
    }

    if (!fs.existsSync(abs)) {
      return res.status(404).json({ ok: false, message: "Archivo no encontrado (quizá ya se limpió)." });
    }

    res.setHeader("Content-Disposition", `inline; filename="${row.file_name}"`);
    res.sendFile(abs);
  }
);