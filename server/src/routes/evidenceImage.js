// server/src/routes/evidenceImage.js
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../utils/mysqlPool.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const evidenceImageRouter = express.Router();

evidenceImageRouter.get(
  "/prof/evidence/:id/image",
  requireAuth(),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          ok: false,
          message: "ID de evidencia inválido.",
        });
      }

      const [rows] = await pool.query(
        `SELECT id, file_name, file_path
         FROM attendance_evidence
         WHERE id = ?
         LIMIT 1`,
        [id]
      );

      const row = rows[0];

      if (!row) {
        return res.status(404).json({
          ok: false,
          message: "No existe evidencia.",
        });
      }

      const baseDir = path.resolve(
        process.env.TAPO_STORAGE_DIR || "storage/tapo"
      );

      const imagePath = row.file_path
        ? path.resolve(row.file_path)
        : path.resolve(baseDir, row.file_name);

      if (!imagePath.startsWith(baseDir + path.sep)) {
        return res.status(403).json({
          ok: false,
          message: "Ruta inválida.",
          baseDir,
          imagePath,
        });
      }

      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          ok: false,
          message: "Archivo no encontrado.",
          baseDir,
          imagePath,
          fileName: row.file_name,
        });
      }

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Disposition", `inline; filename="${row.file_name}"`);
      return res.sendFile(imagePath);
    } catch (err) {
      console.error("Error mostrando imagen de evidencia:", err);

      return res.status(500).json({
        ok: false,
        message: "No se pudo mostrar la imagen.",
        detail: err?.message || String(err),
      });
    }
  }
);