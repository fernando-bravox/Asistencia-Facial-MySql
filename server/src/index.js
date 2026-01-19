import "dotenv/config";
import express from "express";

import cors from "cors";
import dotenv from "dotenv";

import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { profRouter } from "./routes/professor.js";
import { studentRouter } from "./routes/student.js";
import { cameraRouter } from "./routes/camera.js";

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

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`✅ API corriendo en http://localhost:${port}`);
});
