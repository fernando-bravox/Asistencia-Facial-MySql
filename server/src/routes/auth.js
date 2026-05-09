import { Router } from "express";
import { nanoid } from "nanoid";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { findOne, upsert, getById } from "../utils/mysqlDb.js";
import { pool } from "../utils/mysqlPool.js";
import { sendResetCode } from "../utils/mailer.js";

export const authRouter = Router();

function cleanText(value) {
  return String(value || "").trim();
}

function getLastname(user) {
  return cleanText(user?.lastname || user?.lastName || user?.last_name);
}

function getStudentCode(user) {
  return cleanText(
    user?.studentCode ||
      user?.student_code ||
      user?.studentcode ||
      user?.code
  );
}

function buildPublicUser(user) {
  const lastname = getLastname(user);
  const studentCode = getStudentCode(user);

  const fullName =
    cleanText(user?.fullName || user?.fullname || user?.full_name) ||
    `${cleanText(user?.name)} ${lastname}`.trim();

  return {
    id: user.id,
    name: cleanText(user.name),
    lastname,
    fullName,
    email: user.email,
    role: user.role,
    studentCode,
    student_code: studentCode,
    faceId: user.faceId || user.face_id || null,
  };
}

// ===============================
// RECUPERACIÓN DE CONTRASEÑA
// ===============================

authRouter.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Email requerido" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const user = await findOne("users", "email", cleanEmail);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query("DELETE FROM password_resets WHERE email = ?", [
      cleanEmail,
    ]);

    await pool.query(
      "INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)",
      [cleanEmail, code, expiresAt]
    );

    await sendResetCode(cleanEmail, code);

    return res.json({
      message: "Código enviado al correo",
    });
  } catch (err) {
    console.error("forgot-password error:", err);

    return res.status(500).json({
      error: "Error interno al enviar el código",
      detail: err?.message || String(err),
    });
  }
});

authRouter.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const [rows] = await pool.query(
      "SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > NOW()",
      [cleanEmail, cleanCode]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        error: "Código inválido o expirado",
      });
    }

    return res.json({
      message: "Código verificado",
    });
  } catch (err) {
    console.error("verify-code error:", err);

    return res.status(500).json({
      error: "Error interno al verificar el código",
      detail: err?.message || String(err),
    });
  }
});

authRouter.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 8 caracteres",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const [rows] = await pool.query(
      "SELECT * FROM password_resets WHERE email = ? AND code = ? AND expires_at > NOW()",
      [cleanEmail, cleanCode]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        error: "Código inválido o expirado",
      });
    }

    const passwordHash = await hashPassword(newPassword);

    await pool.query("UPDATE users SET password_hash = ? WHERE email = ?", [
      passwordHash,
      cleanEmail,
    ]);

    await pool.query("DELETE FROM password_resets WHERE email = ?", [
      cleanEmail,
    ]);

    return res.json({
      message: "Contraseña actualizada correctamente",
    });
  } catch (err) {
    console.error("reset-password error:", err);

    return res.status(500).json({
      error: "Error interno al cambiar la contraseña",
      detail: err?.message || String(err),
    });
  }
});

// ===============================
// REGISTRO PÚBLICO SOLO ESTUDIANTES
// ===============================

authRouter.post("/register", async (req, res) => {
  try {
    const { name, lastname, email, password, faceId, studentCode } =
      req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 8 caracteres",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = cleanText(name);
    const cleanLastname = cleanText(lastname);
    const cleanStudentCode = cleanText(studentCode);

    const exists = await findOne("users", "email", cleanEmail);

    if (exists) {
      return res.status(409).json({ error: "Email ya registrado" });
    }

    const passwordHash = await hashPassword(password);

    const userId = nanoid();

    const user = {
      name: cleanName,
      lastname: cleanLastname,
      email: cleanEmail,
      passwordHash,
      role: "student",
      studentCode: cleanStudentCode || null,
      faceId: faceId || null,
      createdAt: new Date().toISOString(),
    };

    await upsert("users", userId, user);

    const savedUser = await getById("users", userId);

    const token = signToken({
      id: userId,
      role: "student",
    });

    return res.status(201).json({
      token,
      user: buildPublicUser(savedUser || { id: userId, ...user }),
    });
  } catch (err) {
    console.error("register error:", err);

    return res.status(500).json({
      error: "Error interno",
      detail: err?.message || String(err),
    });
  }
});

// ===============================
// LOGIN
// ===============================

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const user = await findOne("users", "email", cleanEmail);

    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const storedHash = user.passwordHash || user.password_hash;

    if (!storedHash) {
      return res.status(401).json({
        error: "Usuario sin contraseña registrada",
      });
    }

    const ok = await comparePassword(password, storedHash);

    if (!ok) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const token = signToken({
      id: user.id,
      role: user.role,
    });

    return res.json({
      token,
      user: buildPublicUser(user),
    });
  } catch (err) {
    console.error("login error:", err);

    return res.status(500).json({
      error: "Error interno",
      detail: err?.message || String(err),
    });
  }
});

// ===============================
// USUARIO AUTENTICADO
// ===============================

authRouter.get("/me", requireAuth(), async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const user = await getById("users", userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.json({
      user: buildPublicUser(user),
    });
  } catch (err) {
    console.error("me error:", err);

    return res.status(500).json({
      error: "Error interno al cargar el usuario",
      detail: err?.message || String(err),
    });
  }
});