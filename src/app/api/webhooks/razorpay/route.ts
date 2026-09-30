import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { rpc, supabaseConfigured } from "@/lib/server/supabase";

// Razorpay -> MergeCity. The ONLY place upgrades are granted.
// Configure in the Razorpay dashboard with events:
//   payment.captured, subscription.activated, subscription.charged, subscription.cancelled
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !supabaseConfigured()) return NextResponse.json({ error: "not configured" }, { status: 501 });

  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const event = JSON.parse(raw) as {
    event: string;
    payload: {
      payment?: { entity: { id: string; amount: number; status: string; notes?: Record<string, string> } };
      subscription?: { entity: { id: string; quantity: number; status: string; notes?: Record<string, string> } };
    };
  };

  try {
    if (event.event === "payment.captured") {
      const p = event.payload.payment!.entity;
      if (p.notes?.type === "founder" && p.amount === 900 && p.notes.user_id) {
        // Idempotent on gateway_id, so Razorpay retries are safe.
        await rpc("grant_founder", { p_user_id: p.notes.user_id, p_gateway_id: p.id, p_amount: p.amount / 100 });
      }
    }
    if (event.event === "subscription.activated" || event.event === "subscription.charged") {
      const s = event.payload.subscription!.entity;
      if (s.notes?.user_id && s.notes.tower_id && s.notes.team_name) {
        await rpc("grant_tower", {
          p_user_id: s.notes.user_id,
          p_gateway_id: s.id,
          p_tower_id: s.notes.tower_id,
          p_team_name: s.notes.team_name,
          p_seats: s.quantity,
        });
      }
    }
    if (event.event === "subscription.cancelled") {
      const s = event.payload.subscription!.entity;
      await rpc("release_tower", { p_gateway_id: s.id });
    }
  } catch (e) {
    // 5xx makes Razorpay retry later.
    console.error(e);
    return NextResponse.json({ error: "grant failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
