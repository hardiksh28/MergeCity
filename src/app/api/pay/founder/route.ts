import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured, userFromToken } from "@/lib/server/supabase";

// Creates a Razorpay order for the ₹9 founding-resident upgrade.
// The browser opens Razorpay Checkout with the returned order id. Nothing is
// granted here: the upgrade happens only in the webhook once payment is captured.
export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !supabaseConfigured()) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 501 });
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? null;
  const user = await userFromToken(token);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: 900, // paise
      currency: "INR",
      receipt: `founder_${user.id.slice(0, 20)}`,
      notes: { user_id: user.id, type: "founder" },
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "Could not create order" }, { status: 502 });
  const order = (await res.json()) as { id: string; amount: number; currency: string };
  return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId });
}
