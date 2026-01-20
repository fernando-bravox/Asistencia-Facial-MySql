import { Router } from "express";
import { nanoid } from "nanoid";
import { spawn } from "child_process";

import { hashPassword } from "../utils/auth.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { listAll, findOne, getById, upsert, remove } from "../utils/mysqlDb.js"
;

export const adminRouter = Router();
adminRouter.use(requireAuth(), requireRole("admin"));
// =========================
// ✅ STREAM TAPO (RTSP -> MJPEG) para ADMIN (registro de rostros)
// =========================
adminRouter.get("/camera/stream", async (_req, res) => {
  const rtsp = process.env.TAPO_RTSP_URL;
  if (!rtsp) return res.status(500).json({ error: "Falta TAPO_RTSP_URL en .env" });

  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=ffmpeg",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Connection": "close",
  });

  const ff = spawn(
    "ffmpeg",
    [
      "-rtsp_transport", "tcp",
      "-i", rtsp,
      "-vf", "fps=8,scale=640:-1",
      "-f", "mpjpeg",
      "-q:v", "6",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "ignore"] }
  );

  ff.stdout.pipe(res);

  const kill = () => {
    try { ff.kill("SIGKILL"); } catch (_e) {}
  };

  res.on("close", kill);
  res.on("error", kill);
  ff.on("error", kill);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const facesDir = path.join(__dirname, "..", "..", "data", "faces");

function ensureFacesDir() {
  if (!fs.existsSync(facesDir)) fs.mkdirSync(facesDir, { recursive: true });
}

function sanitizeFaceId(faceId) {
  return String(faceId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

function sanitizeFaceDescriptor(faceDescriptor) {
  if (!Array.isArray(faceDescriptor)) return null;
  if (faceDescriptor.length !== 128) return null;

  const cleaned = faceDescriptor.map(n => Number(n));
  if (cleaned.some(n => Number.isNaN(n) || !Number.isFinite(n))) return null;
  return cleaned;
}
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function parseDescriptorMaybe(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!Array.isArray(value) || value.length !== 128) return null;
  const cleaned = value.map(Number);
  if (cleaned.some(n => Number.isNaN(n) || !Number.isFinite(n))) return null;
  return cleaned;
}

async function findDuplicateFaceDescriptor(incomingDescriptor, excludeUserId) {
  const users = await listAll("users"); // ya te devuelve faceDescriptor

  let best = { userId: null, distance: Infinity };
  for (const u of users) {
    if (!u?.id || u.id === excludeUserId) continue;

    const existing = parseDescriptorMaybe(u.faceDescriptor);
    if (!existing) continue;

    const dist = euclideanDistance(incomingDescriptor, existing);
    if (dist < best.distance) best = { userId: u.id, distance: dist };
  }
  return best;
}

function sanitizeStudentCode(studentCode) {
  if (typeof studentCode === "undefined" || studentCode === null) return null;
  const c = String(studentCode).trim();
  return c.length ? c.slice(0, 40) : null;
}

// ============================
// GET USERS ( MySql )
// ============================
adminRouter.get("/users", async (_req, res) => {
  const users = await listAll("users");

  res.json({
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      studentCode: u.studentCode || null, // ✅ agregado
      faceId: u.faceId || null,
      faceDescriptor: u.faceDescriptor || null,
      createdAt: u.createdAt || null,
    })),
  });
});

// ============================
// GENERAR FACEID ÚNICO (Firestore)
// ============================
adminRouter.post("/faceid", async (_req, res) => {
  let faceId = "";
  for (let i = 0; i < 10; i++) {
    faceId = `face-${nanoid(10)}`;
    const exists = await findOne("users", "faceId", faceId);
    if (!exists) break;
  }
  res.json({ faceId });
});

// ============================
// GUARDAR FOTO CAPTURADA (BASE64) - LOCAL (por ahora)
// ============================
adminRouter.post("/faces", async (req, res) => {
  const { faceId: rawFaceId, imageDataUrl } = req.body || {};
  const faceId = sanitizeFaceId(rawFaceId);

  if (!faceId) return res.status(400).json({ error: "faceId inválido" });
  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return res.status(400).json({ error: "Falta imageDataUrl" });
  }

  const m = imageDataUrl.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/i);
  if (!m) return res.status(400).json({ error: "Formato no soportado (usa JPEG/PNG base64)" });

  const ext = m[1].toLowerCase() === "png" ? "png" : "jpg";
  const b64 = m[2];

  if (b64.length > 2_500_000) return res.status(413).json({ error: "Imagen muy grande" });

  ensureFacesDir();
  const filePath = path.join(facesDir, `${faceId}.${ext}`);
  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

  res.json({ ok: true, savedAs: `${faceId}.${ext}` });
});

// ============================
// CREATE USER ( MySql )
// ============================
adminRouter.post("/users", async (req, res) => {
  const { name, email, password, role, faceId, faceDescriptor, studentCode } = req.body || {};

  if (!name || !email || !password || !role) return res.status(400).json({ error: "Faltan campos" });
  if (!["admin", "professor", "student"].includes(role)) return res.status(400).json({ error: "Rol inválido" });

  const cleanEmail = String(email).trim().toLowerCase();

  const exists = await findOne("users", "email", cleanEmail);
  if (exists) return res.status(409).json({ error: "Este correo ya existe" });

  const passwordHash = await hashPassword(password);

  const cleanedFaceId = faceId ? sanitizeFaceId(faceId) : null;
  const cleanedDescriptor = sanitizeFaceDescriptor(faceDescriptor);
const descriptorJson = cleanedDescriptor ? JSON.stringify(cleanedDescriptor) : null;
  const cleanedStudentCode = sanitizeStudentCode(studentCode); // ✅ agregado
// 🚫 Bloquear rostro duplicado (solo si viene descriptor)
if (role === "student" && cleanedDescriptor) {
  const THRESHOLD = 0.50; // 0.45 más estricto | 0.55 más permisivo
  const dup = await findDuplicateFaceDescriptor(cleanedDescriptor, null);

  if (dup.userId && dup.distance < THRESHOLD) {
    return res.status(409).json({
      error: "Este rostro ya está registrado en otro usuario",
      matchUserId: dup.userId,
      distance: dup.distance,
    });
  }
}

  const id = nanoid();

const user = {
  name,
  email: cleanEmail,
  passwordHash,
  role,

  // ✅ GUARDAR CÓDIGO SOLO SI ES ESTUDIANTE (o si te lo mandan)
  studentCode: role === "student" ? (String(studentCode || "").trim() || "") : "",

  faceId: cleanedFaceId || null,
  faceDescriptor: descriptorJson,
  createdAt: new Date().toISOString(),
};
 

  await upsert("users", id, user);

  res.status(201).json({
    user: {
      id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentCode: user.studentCode || null, // ✅
      faceId: user.faceId
    },
  });
});

// ============================
// UPDATE USER (Firestore)
// ============================
adminRouter.put("/users/:id", async (req, res) => {
  const { id } = req.params;
const { name, role, faceId, password, faceDescriptor, studentCode } = req.body || {};

  const user = await getById("users", id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const patch = {};

  if (name) patch.name = name;

  if (role) {
    if (!["admin", "professor", "student"].includes(role)) return res.status(400).json({ error: "Rol inválido" });
    patch.role = role;
  }

  if (typeof studentCode !== "undefined") patch.studentCode = sanitizeStudentCode(studentCode); // ✅

  if (typeof faceId !== "undefined") patch.faceId = faceId ? sanitizeFaceId(faceId) : null;

  if (typeof faceDescriptor !== "undefined") {
  const cleaned = sanitizeFaceDescriptor(faceDescriptor);

  // 🚫 Bloquear rostro duplicado (cuando se actualiza/registrar rostro)
  if (cleaned) {
    const THRESHOLD = 0.50;
    const dup = await findDuplicateFaceDescriptor(cleaned, id);

    if (dup.userId && dup.distance < THRESHOLD) {
      return res.status(409).json({
        error: "Este rostro ya está registrado en otro usuario",
        matchUserId: dup.userId,
        distance: dup.distance,
      });
    }
  }

  patch.faceDescriptor = cleaned ? JSON.stringify(cleaned) : null;
}



  if (password) patch.passwordHash = await hashPassword(password);


  await upsert("users", id, { ...user, ...patch });

  res.json({ ok: true });
});

// ============================
// DELETE USER (Firestore)
// ============================
adminRouter.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  const user = await getById("users", id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  await remove("users", id);

  // Opcional: borrar foto local si existe
  try {
    if (user?.faceId) {
      ensureFacesDir();
      const fid = sanitizeFaceId(user.faceId);
      const jpg = path.join(facesDir, `${fid}.jpg`);
      const png = path.join(facesDir, `${fid}.png`);
      if (fs.existsSync(jpg)) fs.unlinkSync(jpg);
      if (fs.existsSync(png)) fs.unlinkSync(png);
    }
  } catch (_e) {}

  res.json({ ok: true });
});
