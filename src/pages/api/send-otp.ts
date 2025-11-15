// src/pages/api/send-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { email } = req.body;
  // Call the HTTPS callable function URL (you can also call via admin SDK)
  // For simplicity: we expect the function is deployed as sendOtp (callable)
  try {
    const functionsUrl = process.env.NEXT_PUBLIC_SEND_OTP_URL; // optional: direct REST endpoint
    // If using callable via firebase-functions, you can call it client-side with firebase/functions instead.
    // Here we'll just forward by calling your functions endpoint if you set one (or return success for dev)
    // For production implement a secure proxy.
    if (!functionsUrl) {
      // Fallback: return success so dev can proceed
      return res.status(200).json({ success: true });
    }
    const r = await fetch(functionsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
