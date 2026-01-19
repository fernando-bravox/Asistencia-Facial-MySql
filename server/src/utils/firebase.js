import admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1️⃣ Verificar variable de entorno
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error(
    "❌ FIREBASE_SERVICE_ACCOUNT no está definido. Revisa el archivo .env"
  );
}

// 2️⃣ Construir ruta absoluta al JSON
const keyPath = path.join(
  __dirname,
  "..",
  "..",
  process.env.FIREBASE_SERVICE_ACCOUNT
);

// 3️⃣ Verificar que el archivo exista
if (!fs.existsSync(keyPath)) {
  throw new Error(
    `❌ No se encontró el archivo de credenciales Firebase en: ${keyPath}`
  );
}

// 4️⃣ Leer credenciales
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));

// 5️⃣ Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firestore = admin.firestore();
