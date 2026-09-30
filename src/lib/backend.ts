"use client";

/**
 * Demo backend. Everything lives in localStorage so the whole flow works with
 * zero setup. The function signatures mirror what the Supabase version does
 * (see supabase/schema.sql): the city only ever receives PublicResident rows,
 * emails stay in the private table, and upgrades are granted by the payment
 * webhook, never by the browser.
 */

import { CITY, MAX_FLOORS, PLOTS_BY_ID, TOWERS_BY_ID, type PlotDistrict } from "./city";
import { hashString, mulberry32, pick } from "./rng";
import type { Headwear, JoinInput, Look, Me, PublicResident, Team, Tier } from "./types";
import { cleanHandle, isBlockedName, isValidEmail, isValidGithub } from "./moderation";

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

import { FOUNDER_PRICE, SEAT_PRICE } from "./pricing";
export { FOUNDER_PRICE, SEAT_PRICE, money } from "./pricing";

interface Row extends PublicResident {
  email: string;
  refCode: string;
  referredBy: string | null;
  referrals: number;
  demo?: boolean;
}

interface DB {
  v: 4;
  residents: Row[];
  referrals: { referrerId: string; referredId: string; verifiedAt: number }[];
  payments: { userId: string; amount: number; gatewayId: string; status: "captured"; type: "founder" | "subscription"; at: number }[];
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
  const db: DB = { v: 4, residents: [], referrals: [], payments: [], teams: [], codes: {}, meId: null, lastSeen: null, clock: now() };
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
      if (parsed.v === 4) return (cache = parsed);
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

export const backend = {
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

  validate(input: JoinInput): string | null {
    if (!isValidEmail(input.email.trim())) return "Enter a valid email.";
    if (input.github && !isValidGithub(input.github.trim())) return "That GitHub username isn't valid.";
    const h = cleanHandle(input.handle);
    if (h && isBlockedName(h)) return "Pick a different name for your door.";
    return null;
  },

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

    const err = backend.validate(input);
    if (err) throw new Error(err);
    const plot = nextFreePlot(db, "outskirts");
    if (!plot) throw new Error("The city is full. We're zoning a new district.");
    const id = makeId();
    const github = input.github.trim() || null;
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

  /**
   * Demo stand-in for: Dodo checkout -> card/UPI -> webhook `payment.succeeded`
   * -> grant_founder(). In production the browser never calls this.
   */
  async payFounder(): Promise<Me> {
    await wait(1800);
    const db = load();
    const me = db.residents.find((r) => r.id === db.meId);
    if (!me) throw new Error("Sign in first.");
    if (me.tier === "free") {
      const plot = nextFreePlot(db, "mainstreet");
      if (!plot) throw new Error("Main Street is full.");
      me.plotId = plot.id;
      me.tier = "founder";
      db.payments.push({ userId: me.id, amount: FOUNDER_PRICE, gatewayId: "pay_demo_" + makeId(), status: "captured", type: "founder", at: now() });
      save();
    }
    return toMe(db, me);
  },

  async claimTower(towerId: string, name: string, seats: number): Promise<{ me: Me; team: Team }> {
    await wait(1800);
    const db = load();
    const me = db.residents.find((r) => r.id === db.meId);
    if (!me) throw new Error("Sign in first.");
    if (!TOWERS_BY_ID.has(towerId)) throw new Error("Unknown tower.");
    if (db.teams.some((t) => t.towerId === towerId)) throw new Error("That tower was just claimed.");
    const clean = cleanHandle(name);
    if (!clean || isBlockedName(clean)) throw new Error("Pick a different company name.");
    const team: Team = { id: makeId(), name: clean, towerId, seats: Math.max(1, Math.min(seats, TOWERS_BY_ID.get(towerId)!.floors)), ownerId: me.id };
    db.teams.push(team);
    db.payments.push({ userId: me.id, amount: team.seats * SEAT_PRICE, gatewayId: "sub_demo_" + makeId(), status: "captured", type: "subscription", at: now() });
    if (me.tier !== "founder") me.tier = "team";
    save();
    return { me: toMe(db, me), team };
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
      return { residents: db.residents, referrals: db.referrals, payments: db.payments, teams: db.teams };
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

export function plotOf(r: { plotId: string }) {
  return PLOTS_BY_ID.get(r.plotId)!;
}
