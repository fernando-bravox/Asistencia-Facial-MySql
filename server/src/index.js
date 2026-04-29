import "dotenv/config";
import express from "express";

import cors from "cors";
import dotenv from "dotenv";

import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { profRouter } from "./routes/professor.js";
import { studentRouter } from "./routes/student.js";
import { cameraRouter } from "./routes/camera.js";

import cron from "node-cron";
import { startTapoScheduler } from "./storage/tapo/scheduler.js";
import { cleanupExpiredEvidence } from "./storage/tapo/cleanup.js";

import { evidenceRouter } from "./routes/evidence.js";
import { evidenceImageRouter } from "./routes/evidenceImage.js";


dotenv.config();

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "asistencia-facial-api", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/prof", profRouter);
app.use("/api/student", studentRouter);
app.use("/api/camera", cameraRouter);

app.use("/api", evidenceRouter);
app.use("/api", evidenceImageRouter);

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`✅ API corriendo en http://localhost:${port}`);
});

startTapoScheduler();

// ✅ Limpieza normal (producción): todos los días 03:00 AM
cron.schedule("0 3 * * *", async () => {
  console.log("🧹 Ejecutando limpieza de evidencias (03:00 AM)...");
  await cleanupExpiredEvidence();
});

// ✅ Limpieza de prueba: cada 1 minuto (solo si lo activas en .env)
// Cuando lo pongas en 0, deja de ejecutarse y queda solo el de las 3 AM.
if (String(process.env.TAPO_TEST_CLEANUP_EVERY_MIN || "0") === "1") {
  cron.schedule("*/1 * * * *", async () => {
    console.log("🧪 [TEST] Ejecutando limpieza de evidencias cada 1 min...");
    await cleanupExpiredEvidence();
  });
}



import { tapoDevRouter } from "./storage/tapo/devCaptureRoute.js";
app.use("/api", tapoDevRouter);

import { tapoProcessDevRouter } from "./storage/tapo/devProcessRoute.js";
app.use("/api", tapoProcessDevRouter);

// ESTO ES TESTEO NO VALE EN PRODUCCION SOLO ES PA BORRAR CUANDO SE DESEE CON UNA URL
app.get("/api/tapo/cleanup-now", async (_req, res) => {
  await cleanupExpiredEvidence();
  res.json({ ok: true });
});