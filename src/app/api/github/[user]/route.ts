import { NextResponse, type NextRequest } from "next/server";
import { isValidGithub } from "@/lib/moderation";
import { GARDEN_DAYS, GARDEN_WEEKS } from "@/lib/garden";

// Real commit garden: the last few weeks of a user's public GitHub
// contribution calendar (the same levels 0-4 GitHub shows on profiles).
// No token needed; cached for 6 hours.

const DAY = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*?data-level="(\d)"/g;

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/github/[user]">) {
  const { user } = await ctx.params;
  if (!isValidGithub(user)) return NextResponse.json({ error: "bad username" }, { status: 400 });

  const res = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`, {
    headers: { "User-Agent": "MergeCity (merge-city.vercel.app)" },
    next: { revalidate: 21600 },
  });
  if (res.status === 404) return NextResponse.json({ levels: null }, { headers: cache(86400) });
  if (!res.ok) return NextResponse.json({ error: "github unavailable" }, { status: 502 });

  const days = [...(await res.text()).matchAll(DAY)].map((m) => ({ date: m[1], level: +m[2] }));
  days.sort((a, b) => a.date.localeCompare(b.date));
  // Oldest first, ending today: one column per week, one row per day.
  const levels = days.slice(-GARDEN_WEEKS * GARDEN_DAYS).map((d) => Math.min(4, d.level));
  return NextResponse.json({ levels }, { headers: cache(21600) });
}

const cache = (s: number) => ({ "Cache-Control": `public, s-maxage=${s}, stale-while-revalidate=${s}` });
