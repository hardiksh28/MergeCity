import { CITY, CITY_R, HQ, PLOTS_BY_ID, archBoxes, houseBox, towerBox, type Box2 } from "./city";
import type { PublicResident } from "./types";

// Tiny kinematic physics: circle-vs-AABB on the ground plane, plus a ray test
// for camera collision. Much lighter than a full physics engine, which matters
// on budget phones, and everything in the city is an axis-aligned box anyway.

const CELL = 16;
let grid = new Map<string, Box2[]>();

const key = (cx: number, cz: number) => `${cx},${cz}`;

export function rebuildColliders(residents: PublicResident[]) {
  const boxes: Box2[] = [];
  for (const r of residents) {
    const p = PLOTS_BY_ID.get(r.plotId);
    if (p) boxes.push(houseBox(p, r.floors));
  }
  for (const t of CITY.towers) boxes.push(towerBox(t));
  for (const a of CITY.arches) boxes.push(...archBoxes(a));
  boxes.push({ minX: -HQ.r, maxX: HQ.r, minZ: -HQ.r, maxZ: HQ.r, h: HQ.h });

  const g = new Map<string, Box2[]>();
  for (const b of boxes) {
    for (let cx = Math.floor(b.minX / CELL); cx <= Math.floor(b.maxX / CELL); cx++) {
      for (let cz = Math.floor(b.minZ / CELL); cz <= Math.floor(b.maxZ / CELL); cz++) {
        const k = key(cx, cz);
        const list = g.get(k);
        if (list) list.push(b);
        else g.set(k, [b]);
      }
    }
  }
  grid = g;
}

function near(x: number, z: number, r: number, out: Set<Box2>) {
  out.clear();
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      const list = grid.get(key(cx, cz));
      if (list) for (const b of list) out.add(b);
    }
  }
  return out;
}

const scratch = new Set<Box2>();

/** Pushes a circle at (x,z) out of any box it overlaps. Mutates `p`. */
export function resolveCircle(p: { x: number; y: number; z: number }, radius: number) {
  for (let iter = 0; iter < 2; iter++) {
    for (const b of near(p.x, p.z, radius + 1, scratch)) {
      if (p.y > b.h) continue;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      let dx = p.x - cx;
      let dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * radius;
        p.z = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the shallowest axis.
        const l = p.x - b.minX, r = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z;
        const m = Math.min(l, r, t, bt);
        dx = m === l ? -1 : m === r ? 1 : 0;
        dz = m === t ? -1 : m === bt ? 1 : 0;
        if (dx) p.x = (dx < 0 ? b.minX : b.maxX) + dx * radius;
        else p.z = (dz < 0 ? b.minZ : b.maxZ) + dz * radius;
      }
    }
  }
  const d = Math.hypot(p.x, p.z);
  const lim = CITY_R + 20;
  if (d > lim) {
    p.x *= lim / d;
    p.z *= lim / d;
  }
}

/** Distance along a ray until it hits a box (3D slab test), or `max`. */
export function rayDistance(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  max: number,
) {
  let best = max;
  const ex = ox + dx * max;
  const ez = oz + dz * max;
  const cx = (ox + ex) / 2;
  const cz = (oz + ez) / 2;
  for (const b of near(cx, cz, max / 2 + 1, scratch)) {
    let tmin = 0;
    let tmax = best;
    const axes: [number, number, number, number][] = [
      [ox, dx, b.minX, b.maxX],
      [oy, dy, 0, b.h],
      [oz, dz, b.minZ, b.maxZ],
    ];
    let hit = true;
    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) { hit = false; break; }
        continue;
      }
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) { hit = false; break; }
    }
    if (hit && tmin < best) best = tmin;
  }
  return best;
}
