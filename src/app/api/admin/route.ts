import { NextResponse, type NextRequest } from "next/server";
import { rest, rpc, supabaseConfigured, userEmails, userFromToken } from "@/lib/server/supabase";
import { cleanHandle, isBlockedName } from "@/lib/moderation";
import { SITE } from "@/lib/site";

// Admin API for /admin. Only emails in ADMIN_EMAILS (comma-separated;
// defaults to the support email in src/lib/site.ts) get through.

const ADMINS = (process.env.ADMIN_EMAILS || SITE.email)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function guard(req: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase isn't configured on the server (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)." }, { status: 503 });
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? null;
  const user = await userFromToken(token);
  if (!user) return NextResponse.json({ error: "Sign in to MergeCity first, then open /admin again." }, { status: 401 });
  if (!ADMINS.includes((user.email ?? "").toLowerCase()))
    return NextResponse.json({ error: `${user.email} isn't an admin. Sign out and sign in with ${ADMINS[0]}.` }, { status: 403 });
  return null;
}

type Res = { user_id: string; handle: string; github: string | null; look: unknown; tier: string; floors: number; plot_id: string | null; place: number; hidden: boolean; created_at: string };
type Ref = { referrer_id: string; referred_id: string; verified_at: string };
type Pay = { user_id: string; amount: string | number; currency: string; gateway_id: string; created_at: string };
type Claim = { id: string; user_id: string; method: string; txn_id: string; amount: string | number; currency: string; status: string; created_at: string };
type TeamRow = { id: string; name: string; tower_id: string; seats: number; owner_id: string | null };

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const [residents, referrals, payments, claims, teams, emails] = await Promise.all([
      rest<Res[]>("residents?select=*&order=place.asc&limit=10000"),
      rest<Ref[]>("referrals?select=*"),
      rest<Pay[]>("payments?select=user_id,amount,currency,gateway_id,created_at&order=created_at.desc"),
      rest<Claim[]>("payment_claims?select=*&order=created_at.desc&limit=1000"),
      rest<TeamRow[]>("teams?select=id,name,tower_id,seats,owner_id"),
      userEmails(),
    ]);
    const refCount = new Map<string, number>();
    referrals.forEach((r) => refCount.set(r.referrer_id, (refCount.get(r.referrer_id) ?? 0) + 1));
    return NextResponse.json({
      residents: residents.map((r) => ({
        id: r.user_id,
        handle: r.handle,
        github: r.github,
        look: r.look,
        tier: r.tier,
        floors: r.floors,
        plotId: r.plot_id ?? "",
        place: Number(r.place),
        joinedAt: Date.parse(r.created_at),
        hidden: r.hidden,
        email: emails.get(r.user_id) ?? "",
        referrals: refCount.get(r.user_id) ?? 0,
      })),
      referrals: referrals.map((r) => ({ referrerId: r.referrer_id, referredId: r.referred_id, verifiedAt: Date.parse(r.verified_at) })),
      payments: payments.map((p) => ({ userId: p.user_id, amount: Number(p.amount), currency: p.currency, gatewayId: p.gateway_id, at: Date.parse(p.created_at) })),
      claims: claims.map((c) => ({ id: c.id, userId: c.user_id, method: c.method, txnId: c.txn_id, amount: Number(c.amount), currency: c.currency, status: c.status, at: Date.parse(c.created_at) })),
      teams: teams.map((t) => ({ id: t.id, name: t.name, towerId: t.tower_id, seats: t.seats, ownerId: t.owner_id })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const { action, id, handle } = (await req.json().catch(() => ({}))) as { action?: string; id?: string; handle?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  try {
    if (action === "approve") await rpc("approve_payment_claim", { p_claim_id: id });
    else if (action === "reject") await rpc("reject_payment_claim", { p_claim_id: id });
    else if (action === "hide") await rest(`residents?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ hidden: true }) });
    else if (action === "rename") {
      const clean = cleanHandle(handle ?? "");
      if (!clean || isBlockedName(clean)) return NextResponse.json({ error: "Pick a different name." }, { status: 400 });
      await rest(`residents?user_id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ handle: clean }) });
    } else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
