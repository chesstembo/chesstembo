// pages/api/solve.ts
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase-admin/firestore";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_SDK as any)),
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { uid, puzzleId } = req.body;
  if (!uid || !puzzleId) return res.status(400).end();

  const ref = db.collection("users").doc(uid);
  await ref.set({ solved: admin.firestore.FieldValue.arrayUnion(puzzleId) }, { merge: true });

  return res.status(200).json({ ok: true });
}
