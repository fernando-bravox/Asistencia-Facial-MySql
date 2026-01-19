// server/src/middleware/requireAuth.js
import { verifyToken } from "../utils/auth.js";
import { getById } from "../utils/mysqlDb.js";

export function requireAuth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || "";

      // 1) token por header
      let token = header.startsWith("Bearer ") ? header.slice(7) : null;

      // 2) token por query (?token=...) para MJPEG en <img>
      if (!token && typeof req.query?.token === "string") {
        token = req.query.token;
      }

      if (!token) return res.status(401).json({ error: "No autenticado" });

      const decoded = verifyToken(token);

      const user = await getById("users", decoded.sub);
      if (!user) return res.status(401).json({ error: "Usuario inválido" });

      req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
      next();
    } catch (_e) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Sin permisos" });
    next();
  };
}
