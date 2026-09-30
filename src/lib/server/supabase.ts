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
  return (await res.json()) as T;
}

/** Resolves the signed-in user from their Supabase access token. */
export async function userFromToken(token: string | null): Promise<{ id: string } | null> {
  if (!token) return null;
  const res = await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: KEY!, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string };
  return u.id ? { id: u.id } : null;
}
