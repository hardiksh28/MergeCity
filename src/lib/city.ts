import { mulberry32 } from "./rng";

// World units are roughly metres. The city is a grid of blocks; district is
// decided by distance from the HQ plaza at the origin.
export const BLOCK = 30;
export const ROAD = 8;
export const INNER = BLOCK - ROAD; // 22, buildable width of a block
export const HALF_BLOCKS = 7;
export const SUB = 5.5; // sub-plot offset from block centre
export const HOUSE = 4.4; // house footprint
export const FLOOR_H = 2.3;
export const MAX_FLOORS = 5;

export const DOWNTOWN_R = 45;
export const MAINSTREET_R = 110;
export const CITY_R = 190;

export type District = "plaza" | "downtown" | "mainstreet" | "outskirts";
export type PlotDistrict = "mainstreet" | "outskirts";

export const DISTRICT_META: Record<
  District,
  { name: string; color: string; blurb: string }
> = {
  plaza: { name: "Registry Plaza", color: "#ffffff", blurb: "MergeCity Land Registry" },
  downtown: {
    name: "Downtown",
    color: "#ffc15e",
    blurb: "Team towers. One lit floor per paid seat.",
  },
  mainstreet: {
    name: "Main Street",
    color: "#4fd1ff",
    blurb: "Founding residents. Lights on, flags up.",
  },
  outskirts: {
    name: "The Outskirts",
    color: "#7ee787",
    blurb: "Everyone starts here. Invite teammates to build up.",
  },
};

export interface Plot {
  id: string;
  num: number;
  district: PlotDistrict;
  x: number;
  z: number;
  /** Door faces along +x (1) or -x (-1). */
  face: 1 | -1;
  /** Garden sits on this z side of the house. */
  gardenSide: 1 | -1;
  dist: number;
}

export interface TowerSlot {
  id: string;
  num: number;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  floors: number;
  color: string;
}

export interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
}

export interface Arch {
  x: number;
  z: number;
  rotY: number;
  district: District;
}

export const TOWER_FLOOR_H = 4;
const TOWER_COLORS = ["#4fd1ff", "#ffc15e", "#7ee787", "#6b8cff", "#ff9f5a"];

export function districtAt(x: number, z: number): District {
  const d = Math.hypot(x, z);
  if (Math.abs(x) <= INNER / 2 && Math.abs(z) <= INNER / 2) return "plaza";
  if (d <= DOWNTOWN_R) return "downtown";
  if (d <= MAINSTREET_R) return "mainstreet";
  return "outskirts";
}

function build() {
  const rand = mulberry32(20260930);
  const plots: Plot[] = [];
  const towers: TowerSlot[] = [];
  const lamps: [number, number][] = [];
  const trees: [number, number, number][] = [];
  const blocks: { i: number; j: number; district: District }[] = [];

  for (let i = -HALF_BLOCKS; i <= HALF_BLOCKS; i++) {
    for (let j = -HALF_BLOCKS; j <= HALF_BLOCKS; j++) {
      const cx = i * BLOCK;
      const cz = j * BLOCK;
      const d = Math.hypot(cx, cz);
      if (d > CITY_R) continue;
      if (i === 0 && j === 0) {
        blocks.push({ i, j, district: "plaza" });
        continue;
      }
      if (d <= DOWNTOWN_R) {
        blocks.push({ i, j, district: "downtown" });
        const w = 13 + rand() * 6;
        const dd = 13 + rand() * 6;
        const floors = Math.round(12 + rand() * 10 + (DOWNTOWN_R - d) * 0.15);
        towers.push({
          id: "",
          num: 0,
          x: cx,
          z: cz,
          w,
          d: dd,
          h: floors * TOWER_FLOOR_H,
          floors,
          color: TOWER_COLORS[towers.length % TOWER_COLORS.length],
        });
        continue;
      }
      const district: PlotDistrict = d <= MAINSTREET_R ? "mainstreet" : "outskirts";
      blocks.push({ i, j, district });
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          const x = cx + sx * SUB;
          const z = cz + sz * SUB;
          plots.push({
            id: "",
            num: 0,
            district,
            x,
            z,
            face: sx,
            gardenSide: sz,
            dist: Math.hypot(x, z),
          });
        }
      }
      if (district === "outskirts") trees.push([cx, cz, 0.8 + rand() * 0.6]);
    }
  }

  // Fill order: closest to the centre first, so the city grows outward.
  const order = (a: Plot, b: Plot) => a.dist - b.dist || a.x - b.x || a.z - b.z;
  const ms = plots.filter((p) => p.district === "mainstreet").sort(order);
  const os = plots.filter((p) => p.district === "outskirts").sort(order);
  ms.forEach((p, k) => {
    p.num = k + 1;
    p.id = `ms-${k + 1}`;
  });
  os.forEach((p, k) => {
    p.num = k + 1;
    p.id = `os-${k + 1}`;
  });
  towers.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || a.x - b.x || a.z - b.z);
  towers.forEach((t, k) => {
    t.num = k + 1;
    t.id = `T-${String(k + 1).padStart(2, "0")}`;
  });

  // Lamps on two corners of every intersection inside the city.
  for (let i = -HALF_BLOCKS - 1; i <= HALF_BLOCKS; i++) {
    for (let j = -HALF_BLOCKS - 1; j <= HALF_BLOCKS; j++) {
      const x = (i + 0.5) * BLOCK;
      const z = (j + 0.5) * BLOCK;
      if (Math.hypot(x, z) > CITY_R - 10) continue;
      const o = ROAD / 2 + 0.7;
      lamps.push([x + o, z + o], [x - o, z - o]);
    }
  }

  // Plaza trees
  for (const [x, z] of [[-8.5, -8.5], [8.5, -8.5], [-8.5, 8.5], [8.5, 8.5], [-9, 0], [9, 0], [0, -9]]) {
    trees.push([x, z, 0.7]);
  }

  // District gateway arches on the four avenues next to the centre.
  const arches: Arch[] = [];
  for (const [r, district] of [
    [DOWNTOWN_R + 4, "downtown"],
    [MAINSTREET_R + 4, "mainstreet"],
  ] as const) {
    const lane = BLOCK / 2;
    arches.push({ x: lane, z: r, rotY: 0, district });
    arches.push({ x: -lane, z: -r, rotY: Math.PI, district });
    arches.push({ x: r, z: -lane, rotY: Math.PI / 2, district });
    arches.push({ x: -r, z: lane, rotY: -Math.PI / 2, district });
  }

  return { plots: [...ms, ...os], towers, lamps, trees, blocks, arches };
}

export const CITY = build();
export const PLOTS_BY_ID = new Map(CITY.plots.map((p) => [p.id, p]));
export const TOWERS_BY_ID = new Map(CITY.towers.map((t) => [t.id, t]));
export const HQ = { r: 4.5, h: 130 };

export function plotLabel(p: Plot) {
  return `${DISTRICT_META[p.district].name} · Plot ${p.num}`;
}

export function doorPoint(p: Plot, out = 0) {
  return { x: p.x + p.face * (HOUSE / 2 + out), z: p.z };
}

export function houseBox(p: Plot, floors: number): Box2 {
  const h = HOUSE / 2;
  return {
    minX: p.x - h,
    maxX: p.x + h,
    minZ: p.z - h,
    maxZ: p.z + h,
    h: floors * FLOOR_H + 2,
  };
}

export function towerBox(t: TowerSlot): Box2 {
  return {
    minX: t.x - t.w / 2,
    maxX: t.x + t.w / 2,
    minZ: t.z - t.d / 2,
    maxZ: t.z + t.d / 2,
    h: t.h,
  };
}

export function archBoxes(a: Arch): Box2[] {
  // Two pillars either side of the road.
  const along = Math.abs(Math.sin(a.rotY)) > 0.5; // arch spans z if rotated
  const off = ROAD / 2 + 0.6;
  const s = 0.6;
  return [-1, 1].map((k) => {
    const x = along ? a.x : a.x + k * off;
    const z = along ? a.z + k * off : a.z;
    return { minX: x - s, maxX: x + s, minZ: z - s, maxZ: z + s, h: 12 };
  });
}
