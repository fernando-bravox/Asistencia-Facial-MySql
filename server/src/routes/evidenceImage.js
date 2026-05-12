// server/src/routes/evidenceImage.js
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../utils/mysqlPool.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const evidenceImageRouter = express.Router();

function getBaseDir() {
  return path.resolve(
    process.env.TAPO_STORAGE_DIR || path.join(process.cwd(), "storage", "tapo")
  );
}

function normalizeSlash(value) {
  return String(value || "").trim().replace(/\\/g, "/");
}

function getSafeImagePath(row) {
  const baseDir = getBaseDir();

  const fileNameFromDb = normalizeSlash(row.file_name);
  const filePathFromDb = normalizeSlash(row.file_path);

  let fileName = fileNameFromDb || path.posix.basename(filePathFromDb);

  fileName = path.basename(fileName.replace(/\\/g, "/"));

  if (!fileName) {
    return {
      baseDir,
      imagePath: null,
      fileName: null,
    };
  }

  const imagePath = path.resolve(baseDir, fileName);

  return {
    baseDir,
    imagePath,
    fileName,
  };
}

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

      const { baseDir, imagePath, fileName } = getSafeImagePath(row);

      if (!imagePath) {
        return res.status(400).json({
          ok: false,
          message: "La evidencia no tiene archivo asociado.",
          row,
        });
      }

      if (!imagePath.startsWith(baseDir + path.sep)) {
        return res.status(403).json({
          ok: false,
          message: "Ruta inválida.",
          baseDir,
          imagePath,
          fileName,
          rawFilePath: row.file_path,
          rawFileName: row.file_name,
        });
      }

      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
          ok: false,
          message: "El archivo de evidencia no existe en el servidor.",
          baseDir,
          imagePath,
          fileName,
          rawFilePath: row.file_path,
          rawFileName: row.file_name,
        });
      }

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "image/jpeg");

      return res.sendFile(imagePath);
    } catch (error) {
      console.error("Error al obtener imagen de evidencia:", error);

      return res.status(500).json({
        ok: false,
        message: "Error al obtener imagen de evidencia.",
        error: error.message,
      });
    }
  }
);