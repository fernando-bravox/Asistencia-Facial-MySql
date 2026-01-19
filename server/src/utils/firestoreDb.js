import { firestore } from "./firebase.js";

export async function getById(col, id) {
  const snap = await firestore.collection(col).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

export async function findOne(col, field, value) {
  const q = await firestore.collection(col).where(field, "==", value).limit(1).get();
  if (q.empty) return null;
  const d = q.docs[0];
  return { id: d.id, ...d.data() };
}

export async function listAll(col) {
  const snap = await firestore.collection(col).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function queryWhere(col, field, op, value) {
  const snap = await firestore.collection(col).where(field, op, value).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function upsert(col, id, data) {
  await firestore.collection(col).doc(id).set(data, { merge: true });
  return { id, ...data };
}

export async function remove(col, id) {
  await firestore.collection(col).doc(id).delete();
}
