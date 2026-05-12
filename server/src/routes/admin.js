// server/src/routes/admin.js
import { Router } from "express";
import { nanoid } from "nanoid";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { hashPassword } from "../utils/auth.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { listAll, findOne, getById, upsert, remove } from "../utils/mysqlDb.js";
import { pool } from "../utils/mysqlPool.js";

export const adminRouter = Router();

adminRouter.use(requireAuth(), requireRole("admin"));

// =========================
// STREAM TAPO (RTSP -> MJPEG) para ADMIN
// =========================
adminRouter.get("/camera/stream", async (_req, res) => {
  const rtsp = process.env.TAPO_RTSP_URL;

  if (!rtsp) {
    return res.status(500).json({ error: "Falta TAPO_RTSP_URL en .env" });
  }

  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=ffmpeg",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Connection": "close",
  });

  const ff = spawn(
    "ffmpeg",
    [
      "-rtsp_transport",
      "tcp",
      "-i",
      rtsp,
      "-vf",
      "fps=6,scale=1280:-1",
      "-f",
      "mpjpeg",
      "-q:v",
      "6",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "ignore"] }
  );

  ff.stdout.pipe(res);

  const kill = () => {
    try {
      ff.kill("SIGKILL");
    } catch (_e) {}
  };

  res.on("close", kill);
  res.on("error", kill);
  ff.on("error", kill);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const facesDir = path.join(__dirname, "..", "..", "data", "faces");

function ensureFacesDir() {
  if (!fs.existsSync(facesDir)) {
    fs.mkdirSync(facesDir, { recursive: true });
  }
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

  const cleaned = faceDescriptor.map((n) => Number(n));

  if (cleaned.some((n) => Number.isNaN(n) || !Number.isFinite(n))) {
    return null;
  }

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
    try {
      value = JSON.parse(value);
    } catch (_e) {
      return null;
    }
  }

  if (!Array.isArray(value) || value.length !== 128) return null;

  const cleaned = value.map(Number);

  if (cleaned.some((n) => Number.isNaN(n) || !Number.isFinite(n))) {
    return null;
  }

  return cleaned;
}

async function findDuplicateFaceDescriptor(incomingDescriptor, excludeUserId) {
  const users = await listAll("users");

  let best = {
    userId: null,
    distance: Infinity,
  };

  for (const u of users) {
    if (!u?.id || u.id === excludeUserId) continue;

    const existing = parseDescriptorMaybe(u.faceDescriptor || u.face_descriptor);
    if (!existing) continue;

    const dist = euclideanDistance(incomingDescriptor, existing);

    if (dist < best.distance) {
      best = {
        userId: u.id,
        distance: dist,
      };
    }
  }

  return best;
}

function sanitizeStudentCode(studentCode) {
  if (studentCode === undefined || studentCode === null) return null;

  const c = String(studentCode).trim();

  if (!/^\d{4}$/.test(c)) return null;

  return c;
}

function normalizeUserForResponse(u) {
  const lastname = u?.lastname || u?.lastName || u?.last_name || "";
  const studentCode = u?.studentCode || u?.student_code || null;
  const faceId = u?.faceId || u?.face_id || null;
  const faceDescriptor = u?.faceDescriptor || u?.face_descriptor || null;
  const createdAt = u?.createdAt || u?.created_at || null;

  return {
    id: u?.id,
    name: u?.name || "",
    lastname,
    lastName: lastname,
    last_name: lastname,
    fullName: `${u?.name || ""} ${lastname}`.trim(),
    email: u?.email || "",
    role: u?.role || "",
    studentCode,
    faceId,
    faceDescriptor,
    createdAt,
  };
}

// ============================
// GET USERS (MySQL)
// ============================
adminRouter.get("/users", async (_req, res) => {
  try {
    const users = await listAll("users");

    res.json({
      users: users.map((u) => normalizeUserForResponse(u)),
    });
  } catch (error) {
    console.error("Error al listar usuarios:", error);
    res.status(500).json({ error: "Error al listar usuarios" });
  }
});

// ============================
// GENERAR FACEID ÚNICO
// ============================
adminRouter.post("/faceid", async (_req, res) => {
  try {
    let faceId = "";

    for (let i = 0; i < 10; i++) {
      faceId = `face-${nanoid(10)}`;
      const exists = await findOne("users", "faceId", faceId);

      if (!exists) break;
    }

    res.json({ faceId });
  } catch (error) {
    console.error("Error al generar faceId:", error);
    res.status(500).json({ error: "Error al generar faceId" });
  }
});

// ============================
// GUARDAR FOTO CAPTURADA BASE64
// ============================
adminRouter.post("/faces", async (req, res) => {
  try {
    const { faceId: rawFaceId, imageDataUrl } = req.body || {};
    const faceId = sanitizeFaceId(rawFaceId);

    if (!faceId) {
      return res.status(400).json({ error: "faceId inválido" });
    }

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return res.status(400).json({ error: "Falta imageDataUrl" });
    }

    const m = imageDataUrl.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/i);

    if (!m) {
      return res.status(400).json({
        error: "Formato no soportado. Usa JPEG o PNG en base64",
      });
    }

    const ext = m[1].toLowerCase() === "png" ? "png" : "jpg";
    const b64 = m[2];

    if (b64.length > 2_500_000) {
      return res.status(413).json({ error: "Imagen muy grande" });
    }

    ensureFacesDir();

    const filePath = path.join(facesDir, `${faceId}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

    res.json({
      ok: true,
      savedAs: `${faceId}.${ext}`,
    });
  } catch (error) {
    console.error("Error al guardar rostro:", error);
    res.status(500).json({ error: "Error al guardar rostro" });
  }
});

// ============================
// CREATE USER (MySQL)
// ============================
adminRouter.post("/users", async (req, res) => {
  try {
    const {
      name,
      lastname,
      lastName,
      last_name,
      email,
      password,
      role,
      faceId,
      faceDescriptor,
      studentCode,
    } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    if (!["admin", "professor", "student"].includes(role)) {
      return res.status(400).json({ error: "Rol inválido" });
    }

    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanLastname = String(lastname ?? lastName ?? last_name ?? "").trim();

    if (!cleanName) {
      return res.status(400).json({ error: "El nombre no puede estar vacío" });
    }

    const exists = await findOne("users", "email", cleanEmail);

    if (exists) {
      return res.status(409).json({ error: "Este correo ya existe" });
    }

    const passwordHash = await hashPassword(password);

    const cleanedFaceId = faceId ? sanitizeFaceId(faceId) : null;
    const cleanedDescriptor = sanitizeFaceDescriptor(faceDescriptor);
    const descriptorJson = cleanedDescriptor ? JSON.stringify(cleanedDescriptor) : null;

    const cleanedStudentCode =
      role === "student" ? sanitizeStudentCode(studentCode) : null;

    if (role === "student" && !cleanedStudentCode) {
      return res.status(400).json({
        error: "El código del estudiante debe tener exactamente 4 números",
      });
    }

    if (role === "student" && cleanedStudentCode) {
      const existsCode = await findOne("users", "studentCode", cleanedStudentCode);

      if (existsCode) {
        return res.status(409).json({
          error: "Ese código de estudiante ya está registrado",
        });
      }
    }

    if (role === "student" && cleanedDescriptor) {
      const THRESHOLD = 0.5;
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
      name: cleanName,
      lastname: cleanLastname || null,
      email: cleanEmail,
      passwordHash,
      role,
      studentCode: role === "student" ? cleanedStudentCode : null,
      faceId: cleanedFaceId || null,
      faceDescriptor: descriptorJson,
      createdAt: new Date().toISOString(),
    };

    await upsert("users", id, user);

    res.status(201).json({
      user: {
        id,
        ...normalizeUserForResponse({
          ...user,
          id,
        }),
      },
    });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({
      error: "Error al crear usuario",
      detail: error.message,
    });
  }
});

// ============================
// UPDATE USER (MySQL)
// ============================
adminRouter.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      lastname,
      lastName,
      last_name,
      role,
      faceId,
      password,
      faceDescriptor,
      studentCode,
    } = req.body || {};

    console.log("📝 [ADMIN] Body recibido para actualizar usuario:", req.body);

    const user = await getById("users", id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const patch = {};

    if (typeof name !== "undefined") {
      const cleanName = String(name || "").trim();

      if (!cleanName) {
        return res.status(400).json({ error: "El nombre no puede estar vacío" });
      }

      patch.name = cleanName;
    }

    if (
      typeof lastname !== "undefined" ||
      typeof lastName !== "undefined" ||
      typeof last_name !== "undefined"
    ) {
      const cleanLastname = String(lastname ?? lastName ?? last_name ?? "").trim();
      patch.lastname = cleanLastname || null;
    }

    if (typeof role !== "undefined") {
      if (!["admin", "professor", "student"].includes(role)) {
        return res.status(400).json({ error: "Rol inválido" });
      }

      patch.role = role;
    }

    const finalRole = patch.role || user.role;

    if (typeof studentCode !== "undefined") {
      if (finalRole === "student") {
        const cleaned = sanitizeStudentCode(studentCode);

        if (!cleaned) {
          return res.status(400).json({
            error: "El código del estudiante debe tener exactamente 4 números",
          });
        }

        const exists = await findOne("users", "studentCode", cleaned);

        if (exists && exists.id !== id) {
          return res.status(409).json({
            error: "Ese código de estudiante ya está registrado",
          });
        }

        patch.studentCode = cleaned;
      } else {
        patch.studentCode = null;
      }
    } else if (typeof role !== "undefined" && finalRole !== "student") {
      patch.studentCode = null;
    }

    if (typeof faceId !== "undefined") {
      patch.faceId = faceId ? sanitizeFaceId(faceId) : null;
    }

    if (typeof faceDescriptor !== "undefined") {
      const cleaned = sanitizeFaceDescriptor(faceDescriptor);

      if (cleaned) {
        const THRESHOLD = 0.5;
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

    if (password) {
      patch.passwordHash = await hashPassword(password);
    }

    console.log("✅ [ADMIN] Patch final para actualizar:", patch);

    const updateFields = [];
    const updateValues = [];

    if (Object.prototype.hasOwnProperty.call(patch, "name")) {
      updateFields.push("name = ?");
      updateValues.push(patch.name);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "lastname")) {
      updateFields.push("lastname = ?");
      updateValues.push(patch.lastname);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "role")) {
      updateFields.push("role = ?");
      updateValues.push(patch.role);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "studentCode")) {
      updateFields.push("student_code = ?");
      updateValues.push(patch.studentCode);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "faceId")) {
      updateFields.push("face_id = ?");
      updateValues.push(patch.faceId);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "faceDescriptor")) {
      updateFields.push("face_descriptor = ?");
      updateValues.push(patch.faceDescriptor);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "passwordHash")) {
      updateFields.push("password_hash = ?");
      updateValues.push(patch.passwordHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No hay datos para actualizar" });
    }

    updateValues.push(id);

    const [result] = await pool.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );

    console.log("✅ [ADMIN] Resultado UPDATE:", result);

    const updatedUser = await getById("users", id);

    res.json({
      ok: true,
      user: normalizeUserForResponse(updatedUser),
    });
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({
      error: "Error al actualizar usuario",
      detail: error.message,
    });
  }
});

// ============================
// DELETE USER (MySQL)
// ============================
adminRouter.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await getById("users", id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    await remove("users", id);

    try {
      const userFaceId = user.faceId || user.face_id;

      if (userFaceId) {
        ensureFacesDir();

        const fid = sanitizeFaceId(userFaceId);
        const jpg = path.join(facesDir, `${fid}.jpg`);
        const png = path.join(facesDir, `${fid}.png`);

        if (fs.existsSync(jpg)) fs.unlinkSync(jpg);
        if (fs.existsSync(png)) fs.unlinkSync(png);
      }
    } catch (_e) {}

    res.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});