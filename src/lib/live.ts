"use client";

/**
 * The real backend: Supabase auth (6-digit email codes), the database in
 * supabase/schema.sql, and Realtime so new houses appear for everyone.
 * Same shape as the demo backend in backend.ts, which it replaces whenever
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 */

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { cleanHandle, isValidEmail, normalizeGithub, validateJoin } from "./moderation";
import type { AdminData, Backend } from "./backend";
import type { JoinInput, Look, Me, PublicResident, Team, Tier } from "./types";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const LIVE = !!(URL_ && ANON);

let client: SupabaseClient | null = null;
function sb() {
  client ??= createClient(URL_!, ANON!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return client;
}

// ------------------------------------------------------------------ rows

interface ResidentRow {
  id: string;
  handle: string;
  github: string | null;
  look: Look;
  tier: Tier;
  floors: number;
  plot_id: string | null;
  place: number;
  created_at: string;
}
const toResident = (r: ResidentRow): PublicResident => ({
  id: r.id,
  handle: r.handle,
  github: r.github,
  look: r.look,
  tier: r.tier,
  floors: r.floors,
  plotId: r.plot_id ?? "",
  joinedAt: Date.parse(r.created_at),
  place: Number(r.place),
});

// ----------------------------------------------------------------- state

let residents: PublicResident[] = [];
let teams: Team[] = [];
let me: Me | null = null;
let admin: AdminData | null = null;
let adminError = "";
let started = false;
let readyResolve: () => void = () => {};
const ready = new Promise<void>((res) => (readyResolve = res));
const listeners = new Set<() => void>();
const arrivalFns = new Set<(r: PublicResident) => void>();
let newIds: string[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

const emit = () => listeners.forEach((l) => l());

async function session(): Promise<Session | null> {
  return (await sb().auth.getSession()).data.session;
}

async function loadCity() {
  const [r, t] = await Promise.all([
    sb().from("public_residents").select("*").order("place").limit(10000),
    sb().from("teams").select("id,name,tower_id,seats"),
  ]);
  if (r.data) residents = (r.data as ResidentRow[]).filter((x) => x.plot_id).map(toResident);
  if (t.data) teams = t.data.map((x) => ({ id: x.id, name: x.name, towerId: x.tower_id, seats: x.seats, ownerId: null }));
}

async function loadMe(s: Session | null) {
  if (!s) {
    me = null;
    return;
  }
  const uid = s.user.id;
  const pub = residents.find((r) => r.id === uid);
  if (!pub) {
    me = null; // signed in but hasn't moved in yet (or hidden by an admin)
    return;
  }
  const priv = await sb().from("resident_private").select("ref_code").eq("user_id", uid).maybeSingle();
  me = { ...pub, email: s.user.email ?? "", refCode: priv.data?.ref_code ?? "", referrals: Math.max(0, pub.floors - 1), lastSeen: readSeen(uid) };
}

async function refresh() {
  await loadCity();
  await loadMe(await session());
  if (newIds.length) {
    const fresh = residents.filter((r) => newIds.includes(r.id) && r.id !== me?.id);
    newIds = [];
    fresh.forEach((r) => arrivalFns.forEach((fn) => fn(r)));
  }
  emit();
}

function later(ms = 400) {
  clearTimeout(timer);
  timer = setTimeout(() => void refresh(), ms);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  refresh().finally(readyResolve);
  sb()
    .channel("city")
    .on("postgres_changes", { event: "*", schema: "public", table: "residents" }, (p) => {
      if (p.eventType === "INSERT") newIds.push((p.new as { user_id: string }).user_id);
      later();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => later())
    .subscribe();
  // Supabase warns against awaiting its own calls inside this callback, hence the timer.
  sb().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") later(0);
  });
  window.addEventListener("focus", () => later(0));
}

// ------------------------------------------------------- return visits

const seenKey = (uid: string) => `mergecity:seen:${uid}`;
function readSeen(uid: string): Me["lastSeen"] {
  try {
    const raw = localStorage.getItem(seenKey(uid));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------ helpers

function friendly(msg: string) {
  if (/rate limit/i.test(msg)) return "Too many codes were sent. Try again in a few minutes.";
  if (/only request this after/i.test(msg)) return msg.replace(/^For security purposes, /, "").replace(/^./, (c) => c.toUpperCase());
  if (/city full/i.test(msg)) return "The city is full. We're zoning a new district.";
  return msg;
}

async function adminFetch(init?: RequestInit) {
  const s = await session();
  if (!s) throw new Error(`Sign in to MergeCity first (with the admin email), then open /admin again.`);
  const res = await fetch("/api/admin", { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Admin request failed (${res.status}).`);
  return body;
}

// ------------------------------------------------------------ the API

export const live: Backend = {
  demo: false,

  subscribe(fn) {
    listeners.add(fn);
    start();
    return () => listeners.delete(fn);
  },

  whenReady() {
    start();
    return ready;
  },

  city: () => ({ residents, teams }),
  me: () => me,

  async requestCode(email) {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) throw new Error("That email doesn't look right.");
    const { error } = await sb().auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    if (error) throw new Error(friendly(error.message));
    return { devCode: "" };
  },

  validate: validateJoin,

  async verifyAndJoin(input: JoinInput, code: string) {
    const e = input.email.trim().toLowerCase();
    const { data, error } = await sb().auth.verifyOtp({ email: e, token: code.trim(), type: "email" });
    if (error || !data.session) throw new Error("Wrong or expired code.");
    const github = normalizeGithub(input.github);
    const handle = cleanHandle(input.handle) || github || e.split("@")[0].slice(0, 14);
    const { error: moveErr } = await sb().rpc("move_in", { p_handle: handle, p_github: github, p_look: input.look, p_ref: input.ref ?? "" });
    if (moveErr) throw new Error(friendly(moveErr.message));
    await refresh();
    if (!me) throw new Error("You're verified, but we couldn't load your house. Refresh the page.");
    return me;
  },

  signOut() {
    me = null;
    admin = null;
    emit();
    void sb().auth.signOut();
  },

  async simulateTeammate() {
    return null;
  },

  async payFounder() {
    const s = await session();
    if (!s) throw new Error("Sign in first.");
    const res = await fetch("/api/pay/founder", { method: "POST", headers: { Authorization: `Bearer ${s.access_token}` } });
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !body.url) throw new Error(body.error ?? "Couldn't start the checkout. Try again in a minute.");
    return { url: body.url };
  },

  async awaitFounder() {
    // Back from Dodo: the webhook usually lands within seconds. Check every 3s for 2 minutes.
    for (let i = 0; i < 40; i++) {
      await refresh();
      if (me && me.tier !== "free") return true;
      await new Promise((r) => setTimeout(r, 3000));
    }
    return false;
  },

  arrival: () => null,
  onArrival(fn) {
    arrivalFns.add(fn);
    return () => arrivalFns.delete(fn);
  },
  catchUp() {},

  diffSinceLastVisit() {
    if (!me?.lastSeen) return null;
    return {
      newNeighbours: Math.max(0, residents.length - me.lastSeen.residents),
      floorsGained: Math.max(0, me.floors - me.lastSeen.floors),
      upgraded: me.lastSeen.tier !== me.tier,
    };
  },

  markSeen() {
    if (!me) return;
    try {
      localStorage.setItem(seenKey(me.id), JSON.stringify({ at: Date.now(), residents: residents.length, floors: me.floors, tier: me.tier }));
    } catch {}
  },

  admin: {
    all: () => admin,
    error: () => adminError,
    async load() {
      try {
        admin = (await adminFetch()) as AdminData;
        adminError = "";
      } catch (e) {
        adminError = (e as Error).message;
      }
      emit();
    },
    async remove(id) {
      await adminFetch({ method: "POST", body: JSON.stringify({ action: "hide", id }) });
      await live.admin.load();
      later(0);
    },
    async rename(id, handle) {
      await adminFetch({ method: "POST", body: JSON.stringify({ action: "rename", id, handle }) });
      await live.admin.load();
      later(0);
    },
    reset() {},
  },
};
