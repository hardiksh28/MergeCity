import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/server/dodo";
import { rpc, supabaseConfigured, userEmails } from "@/lib/server/supabase";

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
    customer?: { email?: string };
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
    // Founder upgrade. Normally identified by the metadata we attach at checkout; if that's
    // ever missing (e.g. a payment link shared by hand), fall back to the buyer's email.
    const isSubscription = !!d.subscription_id;
    const userId = meta.user_id || (!isSubscription && meta.type !== "team" ? await userIdByEmail(d.customer?.email) : null);
    if (event.type === "payment.succeeded" && !isSubscription && (meta.type === "founder" || !meta.type) && userId && d.payment_id) {
      await rpc("grant_founder", {
        p_user_id: userId,
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

async function userIdByEmail(email?: string) {
  if (!email) return null;
  const want = email.trim().toLowerCase();
  for (const [id, e] of await userEmails()) if (e.toLowerCase() === want) return id;
  return null;
}
