"use client";

import { useEffect, useSyncExternalStore } from "react";
import { backend } from "./backend";
import { GARDEN_DAYS, GARDEN_WEEKS, gardenFor } from "./garden";

// Real contribution levels per GitHub username, fetched once per page load
// from /api/github/[user]. The demo keeps its made-up patterns.

const EMPTY: number[] = new Array(GARDEN_WEEKS * GARDEN_DAYS).fill(0);
const cache = new Map<string, number[] | null>();
const requested = new Set<string>();
const subs = new Set<() => void>();
let version = 0;

function request(name: string) {
  const key = name.toLowerCase();
  if (backend.demo || requested.has(key)) return;
  requested.add(key);
  fetch(`/api/github/${encodeURIComponent(key)}`)
    .then((r) => (r.ok ? r.json() : { levels: null }))
    .then((d: { levels: number[] | null }) => cache.set(key, d.levels))
    .catch(() => requested.delete(key)) // try again on the next render
    .finally(() => {
      version++;
      subs.forEach((f) => f());
    });
}

/** Contribution levels (0-4), oldest first. All zeros until loaded, or for a brand-new account. */
export function gardenLevels(name: string): number[] {
  if (backend.demo) return gardenFor(name);
  const lv = cache.get(name.toLowerCase());
  if (!lv) return EMPTY;
  return lv.length >= EMPTY.length ? lv : [...EMPTY.slice(lv.length), ...lv];
}

/** Loads the gardens for these usernames; the returned number changes whenever one arrives. */
export function useGardens(names: string[]) {
  const key = names.join(",");
  useEffect(() => {
    if (key) key.split(",").forEach(request);
  }, [key]);
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => version,
    () => 0,
  );
}
