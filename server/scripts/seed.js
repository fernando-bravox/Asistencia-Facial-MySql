import dotenv from "dotenv";
import { nanoid } from "nanoid";
import { db, loadDb } from "../src/utils/db.js";
import { hashPassword } from "../src/utils/auth.js";

dotenv.config();

async function run() {
  await loadDb();

  const email = "admin@demo.com";
  const exists = db.data.users.some(u => u.email === email);
  if (exists) {
    console.log("ℹ️ Admin demo ya existe.");
    return;
  }

  const passwordHash = await hashPassword("Admin123*");

  db.data.users.push({
    id: nanoid(),
    name: "Administrador Demo",
    email,
    passwordHash,
    role: "admin",
    faceId: null,
    createdAt: new Date().toISOString()
  });

  await db.write();
  console.log("✅ Admin demo creado: admin@demo.com / Admin123*");
}

run().catch(err => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
