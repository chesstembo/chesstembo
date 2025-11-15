// pages/api/create-checkout-session.ts
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { uid } = req.body;
  // create checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID_MONTHLY, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/premium-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/premium-cancel`,
    metadata: { uid },
  });
  res.status(200).json({ id: session.id, url: session.url });
}
