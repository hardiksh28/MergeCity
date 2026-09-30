"use client";

import { useEffect, useMemo, useRef } from "react";
import { CITY, CITY_R, DISTRICT_META, DOWNTOWN_R, HOUSE, HQ, MAINSTREET_R, PLOTS_BY_ID } from "@/lib/city";
import { MAP, drawArrow, renderCityCanvas } from "@/lib/mapdraw";
import { runtime, useCity } from "@/lib/store";
import { BackButton } from "./BackButton";

/**
 * The clickable board. Works without WebGL, so budget phones and failed GPUs
 * still get the whole waitlist experience.
 */
export function Map2D() {
  const residents = useCity((s) => s.residents);
  const teams = useCity((s) => s.teams);
  const me = useCity((s) => s.me);
  const launch = useCity((s) => s.launch);
  const webgl = useCity((s) => s.webgl);
  const phase = useCity((s) => s.phase);
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef({ x: 0, z: 0, s: 1, init: false });
  const dirty = useRef(true);
  const city = useMemo(() => renderCityCanvas(residents, teams, { ppu: 3, meId: me?.id, launch }), [residents, teams, me?.id, launch]);

  useEffect(() => {
    dirty.current = true;
  }, [city]);

  // Centre on your own house whenever it changes.
  useEffect(() => {
    const p = me ? PLOTS_BY_ID.get(me.plotId) : null;
    if (!p) return;
    view.current.x = p.x;
    view.current.z = p.z;
    view.current.s = Math.max(view.current.s, innerWidth < 640 ? 3.2 : 5);
    dirty.current = true;
  }, [me?.plotId, me]);

  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext("2d")!;
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
      if (!view.current.init) {
        view.current.s = (Math.min(innerWidth, innerHeight) / ((CITY_R + 20) * 2)) * 1.05;
        view.current.init = true;
      }
      dirty.current = true;
    };
    resize();
    window.addEventListener("resize", resize);

    const css = getComputedStyle(document.documentElement);
    const display = css.getPropertyValue("--font-orbitron").trim() || "sans-serif";
    const monoFont = css.getPropertyValue("--font-jbmono").trim() || "monospace";
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const pulse = me || useCity.getState().phase === "explore" ? true : dirty.current;
      if (!pulse) return;
      dirty.current = false;
      const dpr = cv.width / innerWidth;
      const { x, z, s } = view.current;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#060a14";
      g.fillRect(0, 0, cv.width, cv.height);
      g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (innerWidth / 2 - x * s), dpr * (innerHeight / 2 - z * s));
      g.imageSmoothingEnabled = s < city.ppu;
      g.drawImage(city.canvas, -city.extent, -city.extent, city.extent * 2, city.extent * 2);

      // district labels
      g.textAlign = "center";
      g.font = `900 ${14 / s}px ${display}`;
      for (const [r, d] of [[DOWNTOWN_R - 8, "downtown"], [MAINSTREET_R - 8, "mainstreet"], [CITY_R - 8, "outskirts"]] as const) {
        g.fillStyle = DISTRICT_META[d].color;
        g.fillText(DISTRICT_META[d].name.toUpperCase(), 0, -r);
      }
      if (s > 3.5) {
        g.font = `700 ${10 / s}px ${monoFont}`;
        g.fillStyle = "#ffffff";
        for (const r of residents) {
          const p = PLOTS_BY_ID.get(r.plotId);
          if (!p) continue;
          g.fillText(r.handle, p.x, p.z - HOUSE / 2 - 0.6);
        }
        for (const tw of CITY.towers) {
          const team = teams.find((x) => x.towerId === tw.id);
          g.fillText(team ? team.name : `${tw.id} · open site`, tw.x, tw.z);
        }
      }
      g.fillStyle = "#ffffff";
      g.font = `900 ${11 / s}px ${display}`;
      g.fillText("LAND REGISTRY", 0, -HQ.r - 6 / s);
      // you
      const mp = me ? PLOTS_BY_ID.get(me.plotId) : null;
      if (mp) {
        const k = (Math.sin(t / 300) + 1) / 2;
        g.strokeStyle = `rgba(126,231,135,${1 - k})`;
        g.lineWidth = 2 / s;
        g.beginPath();
        g.arc(mp.x, mp.z, HOUSE * (0.8 + k * 1.6), 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "#7ee787";
        g.font = `900 ${12 / s}px ${display}`;
        g.fillText("HOME", mp.x, mp.z + HOUSE + 12 / s);
      }
      // your live position while exploring
      if (useCity.getState().phase === "explore") {
        drawArrow(g, runtime.pos.x, runtime.pos.z, -runtime.facing + Math.PI, 9 / s, MAP.you);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [city, residents, teams, me]);

  // pan / zoom / tap
  useEffect(() => {
    const cv = ref.current!;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;
    const zoomAt = (sx: number, sy: number, f: number) => {
      const v = view.current;
      const wx = v.x + (sx - innerWidth / 2) / v.s;
      const wz = v.z + (sy - innerHeight / 2) / v.s;
      v.s = Math.min(30, Math.max(0.6, v.s * f));
      v.x = wx - (sx - innerWidth / 2) / v.s;
      v.z = wz - (sy - innerHeight / 2) / v.s;
      dirty.current = true;
    };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      cv.setPointerCapture(e.pointerId);
      moved = 0;
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size === 2) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
        pinch = d;
        moved += 10;
        return;
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      moved += Math.abs(dx) + Math.abs(dy);
      view.current.x -= dx / view.current.s;
      view.current.z -= dy / view.current.s;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dirty.current = true;
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = 0;
      if (moved < 6 && pts.size === 0) tap(e.clientX, e.clientY);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    };
    const tap = (sx: number, sy: number) => {
      const v = view.current;
      const wx = v.x + (sx - innerWidth / 2) / v.s;
      const wz = v.z + (sy - innerHeight / 2) / v.s;
      const st = useCity.getState();
      const hit = (px: number, pz: number, h: number) => Math.abs(px - wx) < h && Math.abs(pz - wz) < h;
      for (const r of st.residents) {
        const p = PLOTS_BY_ID.get(r.plotId);
        if (p && hit(p.x, p.z, HOUSE / 2 + 0.6)) return st.set({ panel: r.id === st.me?.id ? { type: "house" } : { type: "neighbour", id: r.id } });
      }
      for (const t of CITY.towers) if (Math.abs(t.x - wx) < t.w / 2 && Math.abs(t.z - wz) < t.d / 2) return st.set({ panel: { type: "tower", towerId: t.id } });
      if (hit(0, 0, HQ.r + 1)) return st.set({ panel: { type: "hq" } });
      for (const p of CITY.plots) if (hit(p.x, p.z, HOUSE / 2 + 0.4)) return st.set({ panel: { type: "vacant", plotId: p.id } });
    };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cv.removeEventListener("pointerdown", down);
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerup", up);
      cv.removeEventListener("pointercancel", up);
      cv.removeEventListener("wheel", wheel);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-10">
      <canvas ref={ref} className="absolute inset-0 h-full w-full touch-none" style={{ cursor: "grab" }} />
      {phase !== "landing" && (
        <div className="pointer-events-none absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex items-center gap-3 sm:left-5 sm:top-5">
          {webgl && <BackButton label="Back to 3D city" />}
          <span className="rounded-full bg-black/55 px-3 py-2 font-display text-[11px] font-bold tracking-widest text-ink backdrop-blur">CITY MAP</span>
        </div>
      )}
      {phase === "explore" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="glass pointer-events-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-2xl !bg-[rgba(8,13,24,0.94)] px-4 py-2.5 text-[11px] text-muted">
            <Legend c={MAP.you} t="You / home" />
            <Legend c={MAP.resident} t="Registered" />
            <Legend c={MAP.founder} t="Founder" />
            <Legend c={MAP.open} t="Open land" dashed />
            <Legend c={MAP.tower} t="Tower" />
            <span className="text-dim">Tap a house to knock · tap land to see the plot</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ c, t, dashed }: { c: string; t: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={dashed ? { border: `1px dashed ${c}` } : { background: c, boxShadow: `0 0 6px ${c}` }} />
      {t}
    </span>
  );
}
