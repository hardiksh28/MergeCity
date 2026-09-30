"use client";

/**
 * The real backend: Supabase auth (6-digit email codes), the database in
 * supabase/schema.sql, and Realtime so new houses appear for everyone.
 * Same shape as the demo backend in backend.ts, which it replaces whenever
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 */

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { cleanHandle, isValidEmail, validateJoin } from "./moderation";
import { checkTxnId, type PayMethod } from "./pricing";
import type { AdminData, Backend, PaymentClaim } from "./backend";
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
interface ClaimRow {
  id: string;
  user_id: string;
  method: PayMethod;
  txn_id: string;
  amount: number | string;
  currency: "INR" | "USD";
  status: PaymentClaim["status"];
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

const toClaim = (c: ClaimRow): PaymentClaim => ({
  id: c.id,
  userId: c.user_id,
  method: c.method,
  txnId: c.txn_id,
  amount: Number(c.amount),
  currency: c.currency,
  status: c.status,
  at: Date.parse(c.created_at),
});

// ----------------------------------------------------------------- state

let residents: PublicResident[] = [];
let teams: Team[] = [];
let me: Me | null = null;
let claim: PaymentClaim | null = null;
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
    claim = null;
    return;
  }
  const uid = s.user.id;
  const pub = residents.find((r) => r.id === uid);
  if (!pub) {
    me = null; // signed in but hasn't moved in yet (or hidden by an admin)
    claim = null;
    return;
  }
  const [priv, c] = await Promise.all([
    sb().from("resident_private").select("ref_code").eq("user_id", uid).maybeSingle(),
    sb().from("payment_claims").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  me = { ...pub, email: s.user.email ?? "", refCode: priv.data?.ref_code ?? "", referrals: Math.max(0, pub.floors - 1), lastSeen: readSeen(uid) };
  const next = c.data ? toClaim(c.data as ClaimRow) : null;
  // Keep the same object when nothing changed, so React doesn't re-render for nothing.
  if (!claim || !next || claim.id !== next.id || claim.status !== next.status) claim = next;
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
  // A payment waiting for approval: check back now and then, and when the tab regains focus.
  setInterval(() => claim?.status === "pending" && later(0), 20000);
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
    const github = input.github.trim();
    const handle = cleanHandle(input.handle) || github || e.split("@")[0].slice(0, 14);
    const { error: moveErr } = await sb().rpc("move_in", { p_handle: handle, p_github: github, p_look: input.look, p_ref: input.ref ?? "" });
    if (moveErr) throw new Error(friendly(moveErr.message));
    await refresh();
    if (!me) throw new Error("You're verified, but we couldn't load your house. Refresh the page.");
    return me;
  },

  signOut() {
    me = null;
    claim = null;
    admin = null;
    emit();
    void sb().auth.signOut();
  },

  async simulateTeammate() {
    return null;
  },

  myClaim: () => claim,

  async submitPayment(method, rawTxnId) {
    const bad = checkTxnId(method, rawTxnId);
    if (bad) throw new Error(bad);
    const { data, error } = await sb().rpc("submit_payment_claim", { p_method: method, p_txn_id: rawTxnId });
    if (error) throw new Error(error.message);
    claim = toClaim(data as ClaimRow);
    emit();
    return claim;
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
    async approve(id) {
      await adminFetch({ method: "POST", body: JSON.stringify({ action: "approve", id }) });
      await live.admin.load();
      later(0);
    },
    async reject(id) {
      await adminFetch({ method: "POST", body: JSON.stringify({ action: "reject", id }) });
      await live.admin.load();
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
