import admin from "firebase-admin";

let _db = null;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_JSON en .env (Service Account de Firebase).");
  }

  // Puede venir como JSON directo o con saltos escapados
  try {
    return JSON.parse(raw);
  } catch {
    // Si Windows te dañó comillas o saltos, intenta normalizar
    const fixed = raw.replace(/\\n/g, "\n");
    return JSON.parse(fixed);
  }
}

export function getFirestore() {
  if (_db) return _db;

  // ✅ Reusar app existente (evita DEFAULT already exists)
  if (!admin.apps.length) {
    const serviceAccount = parseServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  _db = admin.firestore();
  return _db;
}
