"use client";

import { CITY, HQ, PLOTS_BY_ID, doorPoint, towerBox } from "./city";
import { runtime, useCity, type Prompt } from "./store";

export const knock = { id: "", at: 0 };

/** Finds the closest thing the player can interact with. */
export function findPrompt(x: number, z: number): Prompt | null {
  const { residents, me, teams, launch } = useCity.getState();
  let best: Prompt | null = null;
  let bestD = Infinity;
  const consider = (d: number, p: Prompt) => {
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  };

  const taken = new Set<string>();
  for (const r of residents) {
    taken.add(r.plotId);
    const p = PLOTS_BY_ID.get(r.plotId);
    if (!p || Math.abs(p.x - x) > 8 || Math.abs(p.z - z) > 8) continue;
    const dp = doorPoint(p, 1.1);
    const d = Math.hypot(dp.x - x, dp.z - z);
    if (d > 2.6) continue;
    if (r.id === me?.id) consider(d, { key: "me", verb: launch ? "Open MergeMate" : "Enter", label: "your house", panel: { type: "house" } });
    else consider(d, { key: r.id, verb: launch ? "Open MergeMate" : "Knock", label: `${r.handle}'s door`, panel: { type: "neighbour", id: r.id } });
  }

  for (const p of CITY.plots) {
    if (taken.has(p.id) || Math.abs(p.x - x) > 4 || Math.abs(p.z - z) > 4) continue;
    const d = Math.hypot(p.x - x, p.z - z) + 0.5;
    if (d < 3.6) consider(d, { key: p.id, verb: "Read", label: `vacant plot ${p.num}`, panel: { type: "vacant", plotId: p.id } });
  }

  const claimed = new Map(teams.map((t) => [t.towerId, t]));
  for (const t of CITY.towers) {
    const b = towerBox(t);
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    const d = Math.hypot(dx, dz);
    if (d < 2.4) {
      const team = claimed.get(t.id);
      consider(d + 0.3, { key: t.id, verb: "Look up at", label: team ? team.name : `tower ${t.id}`, panel: { type: "tower", towerId: t.id } });
    }
  }

  const dh = Math.max(Math.abs(x), Math.abs(z)) - HQ.r;
  if (dh < 2.4) consider(dh + 0.3, { key: "hq", verb: "Enter", label: "the Land Registry", panel: { type: "registry" } });

  return best;
}

export function interact() {
  const s = useCity.getState();
  if (s.phase !== "explore" || s.panel || !s.prompt) return;
  if (s.prompt.panel.type === "neighbour") {
    knock.id = s.prompt.panel.id;
    knock.at = performance.now();
  }
  if (s.launch && (s.prompt.panel.type === "neighbour" || s.prompt.panel.type === "house")) {
    s.toast("On launch day this door opens MergeMate.", "gold");
  }
  s.set({ panel: s.prompt.panel });
}

export function spawnAtHome() {
  const { me } = useCity.getState();
  if (!me) {
    runtime.teleport = { x: 0, z: 17, facing: Math.PI };
    return;
  }
  const p = PLOTS_BY_ID.get(me.plotId);
  if (!p) return;
  const d = doorPoint(p, 1.6);
  // Camera on the street side, looking back at you with your house behind.
  const facing = (p.face * Math.PI) / 2;
  runtime.teleport = { x: d.x, z: d.z, facing, camYaw: facing + 0.35 };
}

/** Stand in front of a plot's door, looking at it. */
export function visitPlot(plotId: string) {
  const p = PLOTS_BY_ID.get(plotId);
  if (!p) return;
  const d = doorPoint(p, 3);
  const facing = (-p.face * Math.PI) / 2;
  runtime.teleport = { x: d.x, z: d.z, facing, camYaw: facing + Math.PI };
}
