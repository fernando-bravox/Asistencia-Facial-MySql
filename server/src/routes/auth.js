import { Router } from "express";
import { nanoid } from "nanoid";
import { comparePassword, hashPassword, signToken } from "../utils/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { findOne, upsert } from "../utils/mysqlDb.js";

export const authRouter = Router();

/**
 * Registro público SOLO para estudiantes.
 * Profesores/Admin los crea el Admin.
 */
authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password, faceId } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Faltan campos" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const exists = await findOne("users", "email", cleanEmail);
    if (exists) return res.status(409).json({ error: "Email ya registrado" });

    const passwordHash = await hashPassword(password);

    const userId = nanoid();
    const user = {
      name,
      email: cleanEmail,
      passwordHash,
      role: "student",
      faceId: faceId || null,
      createdAt: new Date().toISOString(),
    };

    await upsert("users", userId, user);

    const token = signToken({ id: userId, role: "student" });

    return res.status(201).json({
      token,
      user: { id: userId, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ error: "Error interno", detail: err?.message || String(err) });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Faltan campos" });

    const cleanEmail = String(email).trim().toLowerCase();

    // Buscar usuario en Firestore
    const user = await findOne("users", "email", cleanEmail);
    if (!user) return res.status(401).json({ error: "Credenciales incorrectas" });

    // Comparar password contra hash
    if (!user.passwordHash) {
      return res.status(401).json({ error: "Usuario sin passwordHash en Firestore" });
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Credenciales incorrectas" });

    const token = signToken({ id: user.id, role: user.role });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Error interno", detail: err?.message || String(err) });
  }
});

authRouter.get("/me", requireAuth(), async (req, res) => {
  res.json({ user: req.user });
});
