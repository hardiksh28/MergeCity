import { BLOCK, CITY, CITY_R, DOWNTOWN_R, HALF_BLOCKS, HOUSE, HQ, MAINSTREET_R, PLOTS_BY_ID, ROAD } from "./city";
import type { PublicResident, Team } from "./types";

/**
 * Renders the whole city top-down into an offscreen canvas. Used by the
 * minimap and by the 2D fallback map, so both stay in sync with the 3D world.
 */
export function renderCityCanvas(
  residents: PublicResident[],
  teams: Team[],
  opts: { ppu: number; meId?: string | null; launch?: boolean },
) {
  const { ppu } = opts;
  const extent = CITY_R + 30;
  const size = Math.ceil(extent * 2 * ppu);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  const W = (x: number) => (x + extent) * ppu;

  g.fillStyle = "#07030f";
  g.fillRect(0, 0, size, size);

  // District discs
  const disc = (r: number, c: string) => {
    g.beginPath();
    g.arc(W(0), W(0), r * ppu, 0, Math.PI * 2);
    g.fillStyle = c;
    g.fill();
  };
  disc(CITY_R + 8, "#140828");
  disc(MAINSTREET_R, "#230a2e");
  disc(DOWNTOWN_R, "#071f2c");

  // Roads
  g.strokeStyle = "rgba(190,160,255,0.22)";
  g.lineWidth = ROAD * ppu * 0.8;
  for (let i = -HALF_BLOCKS - 1; i <= HALF_BLOCKS; i++) {
    const v = (i + 0.5) * BLOCK;
    const lim = Math.sqrt(Math.max(0, (CITY_R + 8) ** 2 - v * v));
    g.beginPath();
    g.moveTo(W(v), W(-lim));
    g.lineTo(W(v), W(lim));
    g.moveTo(W(-lim), W(v));
    g.lineTo(W(lim), W(v));
    g.stroke();
  }

  // Ring
  g.strokeStyle = "#ff2bd6";
  g.lineWidth = Math.max(1, ppu * 0.8);
  g.beginPath();
  g.arc(W(0), W(0), (CITY_R + 10) * ppu, 0, Math.PI * 2);
  g.stroke();

  // Towers
  const claimed = new Map(teams.map((t) => [t.towerId, t]));
  for (const t of CITY.towers) {
    const team = claimed.get(t.id);
    g.fillStyle = team ? t.color : "rgba(255,106,61,0.35)";
    g.globalAlpha = team ? 0.85 : 1;
    g.fillRect(W(t.x - t.w / 2), W(t.z - t.d / 2), t.w * ppu, t.d * ppu);
    g.globalAlpha = 1;
    if (!team) {
      g.strokeStyle = "#ff6a3d";
      g.setLineDash([3, 3]);
      g.strokeRect(W(t.x - t.w / 2), W(t.z - t.d / 2), t.w * ppu, t.d * ppu);
      g.setLineDash([]);
    }
  }
  // HQ
  g.fillStyle = "#ffffff";
  g.fillRect(W(-HQ.r), W(-HQ.r), HQ.r * 2 * ppu, HQ.r * 2 * ppu);

  // Vacant plots
  const taken = new Set(residents.map((r) => r.plotId));
  g.strokeStyle = "rgba(139,92,255,0.35)";
  g.lineWidth = 1;
  for (const p of CITY.plots) {
    if (taken.has(p.id)) continue;
    g.strokeRect(W(p.x - HOUSE / 2), W(p.z - HOUSE / 2), HOUSE * ppu, HOUSE * ppu);
  }
  // Houses
  for (const r of residents) {
    const p = PLOTS_BY_ID.get(r.plotId);
    if (!p) continue;
    const lit = r.tier !== "free" || opts.launch;
    g.fillStyle = r.id === opts.meId ? "#b6ff3b" : r.look.outfit;
    g.globalAlpha = r.id === opts.meId ? 1 : lit ? 0.95 : 0.45;
    g.fillRect(W(p.x - HOUSE / 2), W(p.z - HOUSE / 2), HOUSE * ppu, HOUSE * ppu);
    g.globalAlpha = 1;
  }
  return { canvas: cv, extent, ppu };
}

export function worldToMap(x: number, z: number, extent: number, ppu: number) {
  return [(x + extent) * ppu, (z + extent) * ppu] as const;
}
