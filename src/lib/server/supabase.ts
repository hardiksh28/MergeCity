import "server-only";

// Minimal Supabase REST helpers for server routes. Uses the service-role key,
// so this file must never be imported from client code.

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigured() {
  return !!(URL_ && KEY);
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc ${fn} failed: ${res.status} ${await res.text()}`);
  const text = await res.text(); // void functions return an empty body
  return (text ? JSON.parse(text) : null) as T;
}

/** Resolves the signed-in user from their Supabase access token. */
export async function userFromToken(token: string | null): Promise<{ id: string; email?: string } | null> {
  if (!token) return null;
  const res = await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: KEY!, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string; email?: string };
  return u.id ? { id: u.id, email: u.email } : null;
}

/** PostgREST call with the service-role key (bypasses RLS: server only). */
export async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** id -> email for every account (Auth admin API). */
export async function userEmails(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`auth users failed: ${res.status}`);
    const { users } = (await res.json()) as { users: { id: string; email?: string }[] };
    users.forEach((u) => out.set(u.id, u.email ?? ""));
    if (users.length < 1000) break;
  }
  return out;
}
