import { NextResponse, type NextRequest } from "next/server";
import { createCheckout, dodoConfigured } from "@/lib/server/dodo";
import { supabaseConfigured, userFromToken } from "@/lib/server/supabase";

// Starts a team-tower subscription: one seat = one unit of the seat product.
export async function POST(req: NextRequest) {
  const productId = process.env.DODO_SEAT_PRODUCT_ID;
  if (!dodoConfigured() || !productId || !supabaseConfigured()) {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 501 });
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? null;
  const user = await userFromToken(token);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { towerId?: string; teamName?: string; seats?: number };
  const towerId = String(body.towerId ?? "").replace(/[^A-Z0-9-]/gi, "").slice(0, 8);
  const teamName = String(body.teamName ?? "").trim().slice(0, 20);
  const seats = Math.max(1, Math.min(60, Math.floor(Number(body.seats) || 1)));
  if (!towerId || !teamName) return NextResponse.json({ error: "Pick a tower and a team name" }, { status: 400 });

  const session = await createCheckout({
    productId,
    quantity: seats,
    email: user.email,
    metadata: { user_id: user.id, type: "team", tower_id: towerId, team_name: teamName },
    returnUrl: `${req.nextUrl.origin}/?paid=team`,
  });
  return NextResponse.json({ url: session.checkout_url });
}
