"use client";

/**
 * Demo backend. Everything lives in localStorage so the whole flow works with
 * zero setup. The function signatures mirror what the Supabase version does
 * (see supabase/schema.sql): the city only ever receives PublicResident rows,
 * emails stay in the private table, and upgrades are granted by the payment
 * webhook, never by the browser.
 */

import { CITY, MAX_FLOORS, PLOTS_BY_ID, type PlotDistrict } from "./city";
import { hashString, mulberry32, pick } from "./rng";
import type { Headwear, JoinInput, Look, Me, PublicResident, Team, Tier } from "./types";
import { cleanHandle, isValidEmail, normalizeGithub, validateJoin } from "./moderation";
import { LIVE, live } from "./live";

export const OUTFITS = ["#4fd1ff", "#5b7cff", "#7ee787", "#ffc15e", "#ff8a4c", "#e5484d", "#eceff4", "#2e3440"];
export const SKINS = ["#f6d7c3", "#e8b894", "#c98e62", "#a86b43", "#7a4a2a", "#4e2f1c"];
export const HEADWEAR: { id: Headwear; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "spiky", label: "Spiky" },
  { id: "mohawk", label: "Mohawk" },
  { id: "cap", label: "Cap" },
  { id: "beanie", label: "Beanie" },
  { id: "halo", label: "Halo" },
  { id: "none", label: "Bald" },
];

import { FOUNDER_PRICE, FOUNDER_PRICE_INR, checkTxnId, type PayMethod } from "./pricing";
export { FOUNDER_PRICE, FOUNDER_PRICE_INR, SEAT_PRICE, money, rupees } from "./pricing";

/** A buyer's "I paid, here's my transaction ID". Approved by hand in /admin. */
export interface PaymentClaim {
  id: string;
  userId: string;
  method: PayMethod;
  txnId: string;
  amount: number;
  currency: "INR" | "USD";
  status: "pending" | "approved" | "rejected";
  at: number;
}

export interface AdminRow extends PublicResident {
  email: string;
  referrals: number;
  hidden?: boolean;
  demo?: boolean;
}

export interface AdminData {
  residents: AdminRow[];
  referrals: { referrerId: string; referredId: string; verifiedAt: number }[];
  payments: { userId: string; amount: number; currency: "INR" | "USD"; gatewayId: string; at: number }[];
  claims: PaymentClaim[];
  teams: Team[];
}

/** What the UI needs from a backend. `demo` (below) and `live` (live.ts) both implement it. */
export interface Backend {
  demo: boolean;
  subscribe(fn: () => void): () => void;
  whenReady(): Promise<void>;
  city(): { residents: PublicResident[]; teams: Team[] };
  me(): Me | null;
  requestCode(email: string): Promise<{ devCode: string }>;
  validate(input: JoinInput): string | null;
  verifyAndJoin(input: JoinInput, code: string): Promise<Me>;
  signOut(): void;
  simulateTeammate(): Promise<{ me: Me; mate: PublicResident } | null>;
  myClaim(): PaymentClaim | null;
  submitPayment(method: PayMethod, txnId: string): Promise<PaymentClaim>;
  arrival(): PublicResident | null;
  onArrival(fn: (r: PublicResident) => void): () => void;
  catchUp(): void;
  diffSinceLastVisit(): { newNeighbours: number; floorsGained: number; upgraded: boolean } | null;
  markSeen(): void;
  admin: {
    all(): AdminData | null;
    error(): string;
    load(): Promise<void>;
    approve(id: string): void | Promise<void>;
    reject(id: string): void | Promise<void>;
    remove(id: string): void | Promise<void>;
    rename(id: string, handle: string): void | Promise<void>;
    reset(): void;
  };
}

interface Row extends PublicResident {
  email: string;
  refCode: string;
  referredBy: string | null;
  referrals: number;
  demo?: boolean;
}

interface DB {
  v: 5;
  residents: Row[];
  referrals: { referrerId: string; referredId: string; verifiedAt: number }[];
  payments: { userId: string; amount: number; currency: "INR" | "USD"; gatewayId: string; status: "captured"; type: "founder"; at: number }[];
  claims: PaymentClaim[];
  teams: Team[];
  codes: Record<string, { code: string; exp: number; sent: number[] }>;
  meId: string | null;
  lastSeen: Me["lastSeen"] | null;
  clock: number;
}

const KEY = "mergecity:db";
const NAMES = [
  "priya", "arjun", "rahul", "sneha", "kabir", "ananya", "vikram", "meera", "rohan", "isha",
  "aditya", "zoya", "karan", "neha", "dev", "tanvi", "sid", "aarav", "diya", "yash", "riya",
  "ishaan", "kavya", "nikhil", "pooja", "aman", "sana", "varun", "nisha", "harsh", "tara",
  "om", "fatima", "arnav", "mira", "kunal", "ira", "reyansh", "anika", "farhan", "jiya",
  "manav", "saanvi", "rudra", "avni", "parth", "myra", "dhruv", "aisha", "vihaan",
];
const SUFFIX = ["", "", "", ".dev", "_codes", "ships", "404", "_io", "js", "rs", "-ops", "kun", "x"];
const COMPANIES = ["Chaicode Labs", "Bytebazaar", "Tiffin Stack", "Monsoon Systems", "Jugaad Cloud", "Paneer Protocol", "Kernel & Co"];

let cache: DB | null = null;
const listeners = new Set<() => void>();

function now() {
  return Date.now();
}

function randomLook(rand: () => number): Look {
  return { outfit: pick(rand, OUTFITS), skin: pick(rand, SKINS), head: pick(rand, HEADWEAR).id };
}

function refCodeFor(id: string) {
  return hashString(id + ":ref").toString(36).slice(0, 6).padEnd(6, "x");
}

function makeId(rand: () => number = Math.random) {
  return Math.floor(rand() * 2 ** 52).toString(36);
}

function occupied(db: DB) {
  return new Set(db.residents.map((r) => r.plotId));
}

function nextFreePlot(db: DB, district: PlotDistrict) {
  const taken = occupied(db);
  return CITY.plots.find((p) => p.district === district && !taken.has(p.id)) ?? null;
}

function fakeResident(db: DB, rand: () => number, at: number, opts: { tier?: Tier; floors?: number; referredBy?: string | null } = {}): Row | null {
  const tier = opts.tier ?? "free";
  const plot = nextFreePlot(db, tier === "founder" ? "mainstreet" : "outskirts");
  if (!plot) return null;
  const handle = pick(rand, NAMES) + pick(rand, SUFFIX);
  const id = makeId(rand);
  return {
    id,
    handle,
    github: rand() < 0.6 ? handle.replace(/[^a-z0-9-]/gi, "") + (rand() < 0.5 ? "" : Math.floor(rand() * 99)) : null,
    look: randomLook(rand),
    tier,
    floors: opts.floors ?? 1,
    plotId: plot.id,
    joinedAt: at,
    place: db.residents.length + 1,
    email: `${id}@example.com`,
    refCode: refCodeFor(id),
    referredBy: opts.referredBy ?? null,
    referrals: 0,
    demo: true,
  };
}

function seed(): DB {
  const rand = mulberry32(9);
  const db: DB = { v: 5, residents: [], referrals: [], payments: [], claims: [], teams: [], codes: {}, meId: null, lastSeen: null, clock: now() };
  const start = now() - 1000 * 60 * 60 * 24 * 21;
  // A young city: a handful of houses near the centre, the rest is open land.
  const total = 34;
  for (let i = 0; i < total; i++) {
    const founder = rand() < 0.14;
    const floors = founder ? 1 + Math.floor(rand() * 4) : rand() < 0.35 ? 1 + Math.ceil(rand() * 3) : 1;
    const r = fakeResident(db, rand, start + (i / total) * (now() - start - 3.6e6), { tier: founder ? "founder" : "free", floors });
    if (r) db.residents.push(r);
  }
  // A handful of claimed towers so Downtown isn't empty; the rest stay open.
  const towers = [...CITY.towers].sort(() => rand() - 0.5).slice(0, 3);
  towers.forEach((t, k) => {
    db.teams.push({ id: makeId(rand), name: COMPANIES[k], towerId: t.id, seats: 3 + Math.floor(rand() * Math.min(18, t.floors - 3)), ownerId: null });
  });
  return db;
}

function load(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.v === 5) return (cache = parsed);
    }
  } catch {
    /* private mode or corrupted: start fresh */
  }
  cache = seed();
  save();
  return cache;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* quota or private mode: keep working in memory */
  }
  listeners.forEach((l) => l());
}

function toPublic(r: Row): PublicResident {
  return { id: r.id, handle: r.handle, github: r.github, look: r.look, tier: r.tier, floors: r.floors, plotId: r.plotId, joinedAt: r.joinedAt, place: r.place };
}

function toMe(db: DB, r: Row): Me {
  return { ...toPublic(r), email: r.email, refCode: r.refCode, referrals: r.referrals, lastSeen: db.lastSeen ?? undefined };
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ---------------------------------------------------------------- public API

const demo: Backend = {
  demo: true,

  whenReady: () => Promise.resolve(),
  onArrival: () => () => {},

  subscribe(fn: () => void) {
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = null;
        fn();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  },

  city(): { residents: PublicResident[]; teams: Team[] } {
    const db = load();
    return { residents: db.residents.map(toPublic), teams: db.teams };
  },

  me(): Me | null {
    const db = load();
    const r = db.residents.find((x) => x.id === db.meId);
    return r ? toMe(db, r) : null;
  },

  /** Step 1 of join. In production this emails the code via Resend/Postmark. */
  async requestCode(email: string): Promise<{ devCode: string }> {
    await wait(500);
    const db = load();
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) throw new Error("That email doesn't look right.");
    const existing = db.codes[e];
    const sent = (existing?.sent ?? []).filter((t) => now() - t < 10 * 60e3);
    if (sent.length >= 3) throw new Error("Too many codes. Try again in 10 minutes.");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.codes[e] = { code, exp: now() + 10 * 60e3, sent: [...sent, now()] };
    save();
    return { devCode: code };
  },

  validate: validateJoin,

  async verifyAndJoin(input: JoinInput, code: string): Promise<Me> {
    await wait(700);
    const db = load();
    const e = input.email.trim().toLowerCase();
    const entry = db.codes[e];
    if (!entry || entry.exp < now() || entry.code !== code.trim()) throw new Error("Wrong or expired code.");
    delete db.codes[e];

    const existing = db.residents.find((r) => r.email === e);
    if (existing) {
      db.meId = existing.id;
      save();
      return toMe(db, existing);
    }

    const err = validateJoin(input);
    if (err) throw new Error(err);
    const plot = nextFreePlot(db, "outskirts");
    if (!plot) throw new Error("The city is full. We're zoning a new district.");
    const id = makeId();
    const github = normalizeGithub(input.github) || null;
    const handle = cleanHandle(input.handle) || github || e.split("@")[0].slice(0, 14);
    const referrer = input.ref ? db.residents.find((r) => r.refCode === input.ref) : undefined;
    const row: Row = {
      id,
      handle,
      github,
      look: input.look,
      tier: "free",
      floors: 1,
      plotId: plot.id,
      joinedAt: now(),
      place: db.residents.length + 1,
      email: e,
      refCode: refCodeFor(id),
      referredBy: referrer?.id ?? null,
      referrals: 0,
    };
    db.residents.push(row);
    // A floor only counts once the referred person has verified: that's now.
    if (referrer && referrer.email !== e) {
      db.referrals.push({ referrerId: referrer.id, referredId: id, verifiedAt: now() });
      referrer.referrals += 1;
      referrer.floors = Math.min(MAX_FLOORS, referrer.floors + 1);
    }
    db.meId = id;
    db.lastSeen = { at: now(), residents: db.residents.length, floors: 1, tier: "free" };
    save();
    return toMe(db, row);
  },

  signOut() {
    const db = load();
    db.meId = null;
    db.lastSeen = null;
    save();
  },

  /** Demo only: pretend a teammate used your link and verified. */
  async simulateTeammate(): Promise<{ me: Me; mate: PublicResident } | null> {
    await wait(400);
    const db = load();
    const me = db.residents.find((r) => r.id === db.meId);
    if (!me) return null;
    const mate = fakeResident(db, Math.random, now(), { referredBy: me.id });
    if (!mate) return null;
    db.residents.push(mate);
    db.referrals.push({ referrerId: me.id, referredId: mate.id, verifiedAt: now() });
    me.referrals += 1;
    me.floors = Math.min(MAX_FLOORS, me.floors + 1);
    save();
    return { me: toMe(db, me), mate: toPublic(mate) };
  },

  /** The signed-in resident's latest payment claim, if any. */
  myClaim(): PaymentClaim | null {
    const db = load();
    return [...db.claims].reverse().find((c) => c.userId === db.meId) ?? null;
  },

  /**
   * "I've paid": records the transaction ID for a manual check. Nothing is
   * granted here; the house moves only when an admin approves the claim.
   */
  async submitPayment(method: PayMethod, rawTxnId: string): Promise<PaymentClaim> {
    await wait(600);
    const db = load();
    const me = db.residents.find((r) => r.id === db.meId);
    if (!me) throw new Error("Sign in first.");
    if (me.tier !== "free") throw new Error("You're already a founding resident.");
    const txnId = rawTxnId.trim().replace(/\s+/g, "").toUpperCase();
    const bad = checkTxnId(method, txnId);
    if (bad) throw new Error(bad);
    if (db.claims.some((c) => c.txnId === txnId && c.status !== "rejected")) throw new Error("That transaction ID has already been submitted.");
    if (db.claims.some((c) => c.userId === me.id && c.status === "pending")) throw new Error("You already have a payment waiting to be checked.");
    const claim: PaymentClaim = {
      id: makeId(),
      userId: me.id,
      method,
      txnId,
      amount: method === "upi" ? FOUNDER_PRICE_INR : FOUNDER_PRICE,
      currency: method === "upi" ? "INR" : "USD",
      status: "pending",
      at: now(),
    };
    db.claims.push(claim);
    save();
    return claim;
  },

  /** Simulated realtime: a stranger moves in. */
  arrival(): PublicResident | null {
    const db = load();
    const r = fakeResident(db, Math.random, now(), { tier: Math.random() < 0.12 ? "founder" : "free" });
    if (!r) return null;
    db.residents.push(r);
    save();
    return toPublic(r);
  },

  /** On a return visit, let the city grow a little for the time you were away. */
  catchUp() {
    const db = load();
    const mins = (now() - db.clock) / 60e3;
    const n = Math.min(4, Math.floor(mins / 10));
    for (let i = 0; i < n; i++) {
      const r = fakeResident(db, Math.random, db.clock + ((i + 1) / (n + 1)) * (now() - db.clock));
      if (r) db.residents.push(r);
    }
    db.clock = now();
    if (n) save();
  },

  /** Returns what changed since last visit, then records a new snapshot. */
  diffSinceLastVisit(): { newNeighbours: number; floorsGained: number; upgraded: boolean } | null {
    const db = load();
    const me = db.residents.find((r) => r.id === db.meId);
    if (!me || !db.lastSeen) return null;
    const out = {
      newNeighbours: Math.max(0, db.residents.length - db.lastSeen.residents),
      floorsGained: Math.max(0, me.floors - db.lastSeen.floors),
      upgraded: db.lastSeen.tier !== me.tier,
    };
    return out;
  },

  markSeen() {
    const db = load();
    const me = db.residents.find((r) => r.id === db.meId);
    if (!me) return;
    db.lastSeen = { at: now(), residents: db.residents.length, floors: me.floors, tier: me.tier };
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
  },

  // ------------------------------------------------------------- admin (demo)
  admin: {
    all() {
      const db = load();
      return { residents: db.residents, referrals: db.referrals, payments: db.payments, claims: db.claims, teams: db.teams };
    },
    error: () => "",
    load: async () => {},
    /** You checked your bank / PayPal and the money is there: grant the upgrade. */
    approve(claimId: string) {
      const db = load();
      const c = db.claims.find((x) => x.id === claimId);
      const r = c && db.residents.find((x) => x.id === c.userId);
      if (!c || !r || c.status !== "pending") return;
      if (r.tier === "free") {
        const plot = nextFreePlot(db, "mainstreet");
        if (!plot) throw new Error("Main Street is full.");
        r.plotId = plot.id;
        r.tier = "founder";
      }
      c.status = "approved";
      db.payments.push({ userId: r.id, amount: c.amount, currency: c.currency, gatewayId: `${c.method}:${c.txnId}`, status: "captured", type: "founder", at: now() });
      save();
    },
    reject(claimId: string) {
      const db = load();
      const c = db.claims.find((x) => x.id === claimId);
      if (c && c.status === "pending") c.status = "rejected";
      save();
    },
    remove(id: string) {
      const db = load();
      db.residents = db.residents.filter((r) => r.id !== id);
      if (db.meId === id) db.meId = null;
      save();
    },
    rename(id: string, handle: string) {
      const db = load();
      const r = db.residents.find((x) => x.id === id);
      if (r) r.handle = cleanHandle(handle) || "resident";
      save();
    },
    reset() {
      cache = seed();
      save();
    },
  },
};

/** Live Supabase backend when its keys are set, otherwise the local demo. */
export const backend: Backend = LIVE ? live : demo;

export function plotOf(r: { plotId: string }) {
  return PLOTS_BY_ID.get(r.plotId)!;
}
