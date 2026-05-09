import { Router } from "express";
import { nanoid } from "nanoid";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { findOne, upsert } from "../utils/mysqlDb.js";
import { pool } from "../utils/mysqlPool.js";
import { sendResetCode } from "../utils/mailer.js";

export const authRouter = Router();

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

    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expira en 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Eliminar códigos anteriores de ese correo
    await pool.query(
      "DELETE FROM password_resets WHERE email = ?",
      [cleanEmail]
    );

    // Guardar nuevo código
    await pool.query(
      "INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)",
      [cleanEmail, code, expiresAt]
    );

    // Enviar código por correo
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

    // Verificar código antes de cambiar la contraseña
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

    // Tu columna real en MySQL es password_hash
    await pool.query(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [passwordHash, cleanEmail]
    );

    // Borrar código usado
    await pool.query(
      "DELETE FROM password_resets WHERE email = ?",
      [cleanEmail]
    );

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
    const { name, lastname, email, password, faceId } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 8 caracteres",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const cleanLastname = String(lastname || "").trim();

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

      // Se deja passwordHash porque tu utilidad mysqlDb seguramente lo convierte a password_hash.
      passwordHash,

      role: "student",
      faceId: faceId || null,
      createdAt: new Date().toISOString(),
    };

    await upsert("users", userId, user);

    const token = signToken({
      id: userId,
      role: "student",
    });

    return res.status(201).json({
      token,
      user: {
        id: userId,
        name: user.name,
        lastname: user.lastname || "",
        fullName: `${user.name || ""} ${user.lastname || ""}`.trim(),
        email: user.email,
        role: user.role,
      },
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

    // Compatible con passwordHash y password_hash
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

    const lastname = user.lastname || user.lastName || user.last_name || "";

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        lastname,
        fullName: `${user.name || ""} ${lastname}`.trim(),
        email: user.email,
        role: user.role,
      },
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
  const lastname =
    req.user.lastname || req.user.lastName || req.user.last_name || "";

  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      lastname,
      fullName: `${req.user.name || ""} ${lastname}`.trim(),
      email: req.user.email,
      role: req.user.role,
    },
  });
});