import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/server/dodo";
import { rpc, supabaseConfigured } from "@/lib/server/supabase";

// Dodo Payments -> MergeCity. The ONLY place upgrades are granted.
// Subscribe the endpoint to: payment.succeeded, subscription.active,
// subscription.renewed, subscription.cancelled (and subscription.expired).
interface Event {
  type: string;
  data: {
    payment_id?: string;
    subscription_id?: string | null;
    total_amount?: number;
    currency?: string;
    quantity?: number;
    metadata?: Record<string, string>;
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret || !supabaseConfigured()) return NextResponse.json({ error: "not configured" }, { status: 501 });

  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers, secret)) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const event = JSON.parse(raw) as Event;
  const d = event.data;
  const meta = d.metadata ?? {};

  try {
    // Metadata is set by our own server when the checkout is created, so it can be trusted.
    if (event.type === "payment.succeeded" && meta.type === "founder" && meta.user_id && d.payment_id) {
      await rpc("grant_founder", {
        p_user_id: meta.user_id,
        p_gateway_id: d.payment_id, // idempotent: retries are ignored
        p_amount: (d.total_amount ?? 0) / 100,
        p_currency: d.currency ?? "USD",
      });
    }
    if ((event.type === "subscription.active" || event.type === "subscription.renewed") && meta.type === "team" && d.subscription_id) {
      await rpc("grant_tower", {
        p_user_id: meta.user_id,
        p_gateway_id: d.subscription_id,
        p_tower_id: meta.tower_id,
        p_team_name: meta.team_name,
        p_seats: d.quantity ?? 1,
      });
    }
    if ((event.type === "subscription.cancelled" || event.type === "subscription.expired") && d.subscription_id) {
      await rpc("release_tower", { p_gateway_id: d.subscription_id });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "grant failed" }, { status: 500 }); // Dodo retries
  }
  return NextResponse.json({ ok: true });
}
