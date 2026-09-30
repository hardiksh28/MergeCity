import { NextResponse, type NextRequest } from "next/server";

// mergecity.dev/r/abc123 -> the city, with the referral code attached.
// The floor is only granted once the invited person verifies their email.
export async function GET(req: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const clean = code.replace(/[^a-z0-9]/gi, "").slice(0, 12);
  const url = new URL("/", req.url);
  if (clean) url.searchParams.set("ref", clean);
  const res = NextResponse.redirect(url);
  if (clean) res.cookies.set("mc_ref", clean, { maxAge: 60 * 60 * 24 * 30, sameSite: "lax", path: "/" });
  return res;
}
