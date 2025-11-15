// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Environment variables (set via `firebase functions:config:set` or in cloud console)
// Process.env.SENDGRID_API_KEY OR GMAIL_APP_PASSWORD etc. We'll demonstrate nodemailer with Gmail app password here.
// set SEND_FROM (chesstembo@gmail.com) and GMAIL_APP_PASSWORD in functions config

const SEND_FROM = process.env.SEND_FROM || functions.config().email?.from || "chesstembo@gmail.com";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || functions.config().email?.gmail_app_password;

// create transporter (Gmail App Password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: SEND_FROM,
    pass: GMAIL_APP_PASSWORD,
  },
});

// SEND OTP
exports.sendOtp = functions.https.onCall(async (data, context) => {
  const email = data.email;
  if (!email) throw new functions.https.HttpsError("invalid-argument", "Missing email");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = Date.now() + 1000 * 60 * 10;

  const ref = admin.firestore().collection("auth_otps").doc();
  await ref.set({
    email,
    codeHash,
    expiresAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const mail = {
    from: `"Tembo" <${SEND_FROM}>`,
    to: email,
    subject: "Your Tembo verification code",
    text: `Your Tembo verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Tembo verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
  };

  await transporter.sendMail(mail);
  return { success: true };
});

// VERIFY OTP -> return custom token
exports.verifyOtp = functions.https.onCall(async (data, context) => {
  const { email, code } = data;
  if (!email || !code) throw new functions.https.HttpsError("invalid-argument", "Missing fields");
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  const snaps = await admin.firestore()
    .collection("auth_otps")
    .where("email", "==", email)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  let foundDoc = null;
  snaps.forEach((d) => {
    const val = d.data();
    if (val.codeHash === codeHash && val.expiresAt > Date.now()) foundDoc = d;
  });

  if (!foundDoc) {
    throw new functions.https.HttpsError("unauthenticated", "Invalid or expired code");
  }

  const uid = `email:${email}`;

  try {
    await admin.auth().getUser(uid);
  } catch (e) {
    await admin.auth().createUser({ uid, email, displayName: email.split("@")[0] });
  }

  const token = await admin.auth().createCustomToken(uid);

  // optionally delete used OTP
  await admin.firestore().collection("auth_otps").doc(foundDoc.id).delete();

  return { token };
});

// ELO update on game finish
exports.onGameFinished = functions.firestore
  .document("games/{gameId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === "finished") return null;
    if (after.status !== "finished") return null;

    const uidWhite = after.white;
    const uidBlack = after.black;
    const result = after.result; // "1-0" | "0-1" | "1/2-1/2"

    const db = admin.firestore();
    const wSnap = await db.doc(`users/${uidWhite}`).get();
    const bSnap = await db.doc(`users/${uidBlack}`).get();
    const Rw = (wSnap.exists && wSnap.data().rating) || 1200;
    const Rb = (bSnap.exists && bSnap.data().rating) || 1200;

    const S_w = result === "1-0" ? 1 : result === "1/2-1/2" ? 0.5 : 0;
    const S_b = 1 - S_w;

    const K = 20;
    const Ew = 1 / (1 + Math.pow(10, (Rb - Rw) / 400));
    const Eb = 1 / (1 + Math.pow(10, (Rw - Rb) / 400));
    const newRw = Math.round(Rw + K * (S_w - Ew));
    const newRb = Math.round(Rb + K * (S_b - Eb));

    const batch = db.batch();
    batch.update(db.doc(`users/${uidWhite}`), { rating: newRw });
    batch.update(db.doc(`users/${uidBlack}`), { rating: newRb });
    await batch.commit();

    return null;
  });
