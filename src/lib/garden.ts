import { hashString, mulberry32 } from "./rng";

export const GARDEN_WEEKS = 6;
export const GARDEN_DAYS = 7;
export const GARDEN_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

/**
 * Contribution levels (0-4) for the last few weeks, oldest first.
 * The "easy version" from the brief: a stable pattern derived from the
 * username. Swap for real data from the GitHub GraphQL API once OAuth lands.
 */
export function gardenFor(github: string): number[] {
  const rand = mulberry32(hashString(github.toLowerCase()));
  const activity = 0.35 + rand() * 0.6;
  const out: number[] = [];
  for (let i = 0; i < GARDEN_WEEKS * GARDEN_DAYS; i++) {
    const day = i % 7;
    const weekend = day === 0 || day === 6 ? 0.45 : 1;
    const r = rand() * weekend * activity * 1.6;
    out.push(r < 0.25 ? 0 : r < 0.55 ? 1 : r < 0.85 ? 2 : r < 1.1 ? 3 : 4);
  }
  return out;
}
