// tapo/cleanup.js
import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { pool } from "../../utils/mysqlPool.js";

const TZ = "America/Guayaquil";

export async function cleanupExpiredEvidence() {
  // usamos el NOW() de MySQL para evitar líos de zona horaria/formato
  const [rows] = await pool.query(
    `SELECT id, file_path AS filePath
     FROM attendance_evidence
     WHERE expires_at < NOW()`
  );

  for (const r of rows) {
    try {
      if (r.filePath) {
        await fs.promises.unlink(path.resolve(r.filePath)).catch(() => {});
      }
    } catch (_) {}
  }

  const [del] = await pool.query(
    `DELETE FROM attendance_evidence
     WHERE expires_at < NOW()`
  );

  console.log(`🧹 Evidencias encontradas=${rows.length} eliminadas_db=${del?.affectedRows ?? 0}`);
}