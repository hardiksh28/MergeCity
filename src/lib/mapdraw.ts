import { BLOCK, CITY, CITY_R, DISTRICT_META, DOWNTOWN_R, HALF_BLOCKS, HOUSE, HQ, MAINSTREET_R, PLOTS_BY_ID, ROAD } from "./city";
import type { PublicResident, Team } from "./types";

/** Map colours, shared by the minimap, the full map and their legends. */
export const MAP = {
  you: "#7ee787",
  home: "#7ee787",
  resident: "#c9d4e5",
  founder: "#4fd1ff",
  open: "#3f6b4b",
  openMain: "#2f5a70",
  tower: "#ffc15e",
  registry: "#ffffff",
  road: "#2b3342",
};

/**
 * Renders the whole city top-down into an offscreen canvas. Used by the
 * minimap and the full map, so both stay in sync with the 3D world.
 */
export function renderCityCanvas(residents: PublicResident[], teams: Team[], opts: { ppu: number; meId?: string | null; launch?: boolean }) {
  const { ppu } = opts;
  const extent = CITY_R + 40;
  const size = Math.ceil(extent * 2 * ppu);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  const W = (x: number) => (x + extent) * ppu;

  g.fillStyle = "#08100c";
  g.fillRect(0, 0, size, size);

  const disc = (r: number, c: string) => {
    g.beginPath();
    g.arc(W(0), W(0), r * ppu, 0, Math.PI * 2);
    g.fillStyle = c;
    g.fill();
  };
  disc(CITY_R + 6, "#0f1c14");
  disc(MAINSTREET_R, "#0f1a20");
  disc(DOWNTOWN_R, "#1a1f29");

  // Roads with a lighter centre line
  for (let i = -HALF_BLOCKS - 1; i <= HALF_BLOCKS; i++) {
    const v = (i + 0.5) * BLOCK;
    const lim = Math.sqrt(Math.max(0, (CITY_R + 6) ** 2 - v * v));
    for (const [w, c] of [[ROAD, MAP.road], [0.4, "#465063"]] as const) {
      g.strokeStyle = c;
      g.lineWidth = w * ppu;
      g.beginPath();
      g.moveTo(W(v), W(-lim));
      g.lineTo(W(v), W(lim));
      g.moveTo(W(-lim), W(v));
      g.lineTo(W(lim), W(v));
      g.stroke();
    }
  }

  // District borders
  g.setLineDash([6 * ppu, 4 * ppu]);
  g.lineWidth = Math.max(1, ppu * 0.7);
  for (const [r, d] of [[DOWNTOWN_R, "downtown"], [MAINSTREET_R, "mainstreet"], [CITY_R + 6, "outskirts"]] as const) {
    g.strokeStyle = DISTRICT_META[d].color + "99";
    g.beginPath();
    g.arc(W(0), W(0), r * ppu, 0, Math.PI * 2);
    g.stroke();
  }
  g.setLineDash([]);

  // Towers: built ones solid, open sites dashed
  const claimed = new Map(teams.map((t) => [t.towerId, t]));
  for (const t of CITY.towers) {
    const x = W(t.x - t.w / 2), y = W(t.z - t.d / 2), w = t.w * ppu, h = t.d * ppu;
    if (claimed.has(t.id)) {
      g.fillStyle = MAP.tower;
      g.fillRect(x, y, w, h);
    } else {
      g.strokeStyle = MAP.tower + "aa";
      g.lineWidth = Math.max(1, ppu * 0.5);
      g.setLineDash([3 * ppu, 2 * ppu]);
      g.strokeRect(x, y, w, h);
      g.setLineDash([]);
    }
  }

  // Registry
  g.fillStyle = MAP.registry;
  g.fillRect(W(-HQ.r), W(-HQ.r), HQ.r * 2 * ppu, HQ.r * 2 * ppu);

  // Open land parcels
  const taken = new Set(residents.map((r) => r.plotId));
  g.lineWidth = Math.max(1, ppu * 0.35);
  for (const p of CITY.plots) {
    if (taken.has(p.id)) continue;
    g.strokeStyle = p.district === "mainstreet" ? MAP.openMain : MAP.open;
    g.strokeRect(W(p.x - HOUSE / 2), W(p.z - HOUSE / 2), HOUSE * ppu, HOUSE * ppu);
  }
  // Houses
  for (const r of residents) {
    const p = PLOTS_BY_ID.get(r.plotId);
    if (!p) continue;
    const me = r.id === opts.meId;
    g.fillStyle = me ? MAP.home : r.tier !== "free" ? MAP.founder : MAP.resident;
    const pad = me ? -0.6 : 0;
    g.fillRect(W(p.x - HOUSE / 2 + pad), W(p.z - HOUSE / 2 + pad), (HOUSE - pad * 2) * ppu, (HOUSE - pad * 2) * ppu);
    if (me) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = Math.max(1, ppu * 0.5);
      g.strokeRect(W(p.x - HOUSE / 2 + pad), W(p.z - HOUSE / 2 + pad), (HOUSE - pad * 2) * ppu, (HOUSE - pad * 2) * ppu);
    }
  }
  return { canvas: cv, extent, ppu };
}

/** Where to write each district's name on a map. */
export const DISTRICT_LABELS = [
  { d: "downtown", x: 0, z: -DOWNTOWN_R + 7 },
  { d: "mainstreet", x: 0, z: -MAINSTREET_R + 7 },
  { d: "outskirts", x: 0, z: -CITY_R + 4 },
] as const;

export function drawArrow(g: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = color;
  g.strokeStyle = "#04070d";
  g.lineWidth = size * 0.18;
  g.beginPath();
  g.moveTo(0, -size);
  g.lineTo(size * 0.7, size * 0.75);
  g.lineTo(0, size * 0.35);
  g.lineTo(-size * 0.7, size * 0.75);
  g.closePath();
  g.stroke();
  g.fill();
  g.restore();
}
