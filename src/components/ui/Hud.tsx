"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DISTRICT_META, HQ, PLOTS_BY_ID, districtAt } from "@/lib/city";
import { interact, spawnAtHome } from "@/lib/interact";
import { DISTRICT_LABELS, MAP, drawArrow, renderCityCanvas } from "@/lib/mapdraw";
import { runtime, useCity } from "@/lib/store";
import { backend } from "@/lib/backend";
import { SITE } from "@/lib/site";
import { Joystick } from "./Joystick";
import { Logo } from "./Logo";
import { BackButton } from "./BackButton";

export function Hud() {
  const me = useCity((s) => s.me);
  const guest = useCity((s) => s.guest);
  const prompt = useCity((s) => s.prompt);
  const panel = useCity((s) => s.panel);
  const isTouch = useCity((s) => s.isTouch);
  const map2d = useCity((s) => s.map2d);
  const launch = useCity((s) => s.launch);
  const quality = useCity((s) => s.quality);
  const set = useCity((s) => s.set);
  const [district, setDistrict] = useState(districtAt(runtime.pos.x, runtime.pos.z));
  const [menu, setMenu] = useState(false);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const i = setInterval(() => setDistrict(districtAt(runtime.pos.x, runtime.pos.z)), 400);
    const h = setTimeout(() => setHint(false), 14000);
    return () => {
      clearInterval(i);
      clearTimeout(h);
    };
  }, []);

  const meta = DISTRICT_META[district];
  const plot = me ? PLOTS_BY_ID.get(me.plotId) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 pt-[env(safe-area-inset-top)]">
      {/* top-left */}
      <div className={`absolute left-3 top-3 flex-col items-start gap-2 sm:left-5 sm:top-5 ${map2d ? "hidden" : "flex"}`}>
        <div className="flex items-center gap-3">
          <BackButton label="Exit" />
          <span className="hidden sm:block">
            <Logo small />
          </span>
        </div>
        <div key={district} className="chip rise !py-1 !bg-black/50" style={{ color: meta.color, borderColor: meta.color + "55" }}>
          ◆ You are in {meta.name}
        </div>
        {plot && (
          <button className="chip pointer-events-auto !bg-black/50 hover:text-ink" onClick={() => set({ panel: { type: "house" } })}>
            ⌂ Your plot {plot.num} · {me!.floors}F
          </button>
        )}
      </div>

      {/* guest CTA */}
      {guest && !me && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 sm:top-5">
          <button className="btn btn-primary pointer-events-auto !px-4 !py-2.5 !text-[11px]" onClick={() => set({ phase: "join", panel: null })}>
            Visiting · Move in →
          </button>
        </div>
      )}

      {launch && (
        <div className="absolute left-1/2 top-16 w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-amber/40 bg-amber/15 px-4 py-2.5 text-center text-sm text-amber backdrop-blur sm:top-20">
          <b className="font-display tracking-wider">LAUNCH DAY.</b> MergeMate is live. Every door in the city opens the app.
        </div>
      )}

      {/* top-right */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2 sm:right-5 sm:top-5">
        {!map2d && <Minimap />}
        <div className="pointer-events-auto flex gap-1.5">
          {me && (
            <button className="chip hover:text-ink" onClick={() => { spawnAtHome(); set({ panel: null }); }}>
              Home
            </button>
          )}
          <button className="chip hover:text-ink" onClick={() => set({ panel: { type: "registry" } })}>
            Registry
          </button>
          <button className="chip hover:text-ink" onClick={() => set({ map2d: !map2d })}>
            {map2d ? "3D" : "Map"}
          </button>
          <button className="chip hover:text-ink" onClick={() => setMenu(!menu)} aria-expanded={menu}>
            ⋯
          </button>
        </div>
        {menu && (
          <div className="glass sheet-in pointer-events-auto w-56 rounded-2xl p-2 text-sm">
            <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" onClick={() => set({ quality: quality === "high" ? "low" : "high" })}>
              Graphics: <b>{quality === "high" ? "High" : "Battery saver"}</b>
            </button>
            <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" onClick={() => set({ launch: !launch })}>
              Preview launch day: <b>{launch ? "On" : "Off"}</b>
            </button>
            {(backend.demo || me?.email === SITE.email) && (
              <a className="block w-full rounded-lg px-3 py-2 text-left text-muted hover:bg-white/5" href="/admin">
                Admin{backend.demo ? " (demo)" : ""}
              </a>
            )}
          </div>
        )}
      </div>

      {/* interaction prompt */}
      {prompt && !panel && !map2d && (
        <div className={`absolute left-1/2 -translate-x-1/2 ${isTouch ? "bottom-[190px]" : "bottom-10"}`}>
          <button key={prompt.key} className="glass sheet-in pointer-events-auto flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5" onClick={interact}>
            <span className="kbd !h-8 !min-w-8 !text-sm text-lime" style={{ borderColor: "#7ee78788" }}>{isTouch ? "●" : "E"}</span>
            <span className="whitespace-nowrap text-sm">
              <b className="font-semibold">{prompt.verb}</b> <span className="text-muted">· {prompt.label}</span>
            </span>
          </button>
        </div>
      )}

      {/* controls */}
      {map2d ? null : isTouch ? (
        <TouchControls />
      ) : (
        hint && (
          <div className="glass absolute bottom-5 left-5 hidden rounded-2xl p-3 text-xs text-muted sm:block">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1"><span className="kbd">W</span><span className="kbd">A</span><span className="kbd">S</span><span className="kbd">D</span> move</span>
              <span className="flex items-center gap-1"><span className="kbd">Shift</span> run</span>
              <span className="flex items-center gap-1"><span className="kbd">Space</span> jump</span>
              <span className="flex items-center gap-1"><span className="kbd">E</span> interact</span>
              <span>drag to look · scroll to zoom</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function TouchControls() {
  const [run, setRun] = useState(false);
  return (
    <>
      <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-5">
        <Joystick />
      </div>
      <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 flex items-end gap-3">
        <button
          className={`grid h-14 w-14 place-items-center rounded-full border font-mono text-[10px] uppercase tracking-wider backdrop-blur ${run ? "border-cyan bg-cyan/20 text-cyan" : "border-line bg-black/30 text-muted"}`}
          onClick={() => { runtime.run = !run; setRun(!run); }}
        >
          Run
        </button>
        <button
          className="grid h-20 w-20 place-items-center rounded-full border border-blue/60 bg-blue/15 font-display text-xs font-bold tracking-wider text-blue backdrop-blur active:scale-95"
          onPointerDown={(e) => { e.stopPropagation(); runtime.jump = true; }}
        >
          JUMP
        </button>
      </div>
    </>
  );
}

const ZOOMS = [35, 65, 130];

function Minimap() {
  const residents = useCity((s) => s.residents);
  const teams = useCity((s) => s.teams);
  const meId = useCity((s) => s.me?.id);
  const myPlotId = useCity((s) => s.me?.plotId);
  const launch = useCity((s) => s.launch);
  const set = useCity((s) => s.set);
  const ref = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState(65); // world units from centre to edge
  const city = useMemo(() => renderCityCanvas(residents, teams, { ppu: 2.5, meId, launch }), [residents, teams, meId, launch]);

  useEffect(() => {
    let raf = 0;
    const cv = ref.current!;
    const g = cv.getContext("2d")!;
    const S = cv.width;
    const css = getComputedStyle(document.documentElement);
    const display = css.getPropertyValue("--font-orbitron").trim() || "sans-serif";
    const home = myPlotId ? PLOTS_BY_ID.get(myPlotId) : null;

    // Draws a marker, or an arrow on the rim pointing at it when it's off the map.
    const marker = (wx: number, wz: number, px: number, pz: number, k: number, color: string, label: string, icon: (x: number, y: number) => void) => {
      const mx = S / 2 + (wx - px) * k;
      const my = S / 2 + (wz - pz) * k;
      const pad = S * 0.09;
      if (mx > pad && mx < S - pad && my > pad && my < S - pad) {
        icon(mx, my);
        return;
      }
      const ang = Math.atan2(my - S / 2, mx - S / 2);
      const r = S / 2 - pad * 0.75;
      const ex = S / 2 + Math.cos(ang) * r;
      const ey = S / 2 + Math.sin(ang) * r;
      drawArrow(g, ex, ey, ang + Math.PI / 2, S * 0.035, color);
      const dist = Math.round(Math.hypot(wx - px, wz - pz));
      g.font = `700 ${S * 0.04}px ${display}`;
      g.textAlign = "center";
      g.fillStyle = color;
      g.fillText(`${label} ${dist}m`, S / 2 + Math.cos(ang) * (r - S * 0.1), S / 2 + Math.sin(ang) * (r - S * 0.1) + S * 0.015);
    };

    const draw = () => {
      const { x, z } = runtime.pos;
      const k = S / (view * 2);
      g.fillStyle = "#08100c";
      g.fillRect(0, 0, S, S);
      g.drawImage(city.canvas, (x - view + city.extent) * city.ppu, (z - view + city.extent) * city.ppu, view * 2 * city.ppu, view * 2 * city.ppu, 0, 0, S, S);

      // district names
      g.textAlign = "center";
      g.font = `900 ${S * 0.042}px ${display}`;
      for (const l of DISTRICT_LABELS) {
        const mx = S / 2 + (l.x - x) * k;
        const my = S / 2 + (l.z - z) * k;
        if (mx < 0 || mx > S || my < 0 || my > S) continue;
        g.fillStyle = DISTRICT_META[l.d].color;
        g.fillText(DISTRICT_META[l.d].name.toUpperCase(), mx, my);
      }

      // registry + home
      marker(0, 0, x, z, k, "#ffffff", "REGISTRY", (mx, my) => {
        g.fillStyle = "#fff";
        g.font = `900 ${S * 0.04}px ${display}`;
        g.fillText("REGISTRY", mx, my - HQ.r * k - S * 0.02);
      });
      if (home) {
        marker(home.x, home.z, x, z, k, MAP.home, "HOME", (mx, my) => {
          g.fillStyle = MAP.home;
          g.font = `900 ${S * 0.04}px ${display}`;
          g.fillText("HOME", mx, my - S * 0.04);
        });
      }

      // view cone
      const yaw = runtime.camYaw + Math.PI;
      const dir = Math.atan2(Math.cos(yaw), Math.sin(yaw));
      const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.35);
      grad.addColorStop(0, "rgba(233,238,247,0.28)");
      grad.addColorStop(1, "rgba(233,238,247,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(S / 2, S / 2);
      g.arc(S / 2, S / 2, S * 0.35, dir - 0.55, dir + 0.55);
      g.fill();
      drawArrow(g, S / 2, S / 2, -runtime.facing + Math.PI, S * 0.045, MAP.you);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [city, view, myPlotId]);

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1.5">
      <div className="relative overflow-hidden rounded-2xl border border-white/15 shadow-[0_10px_40px_-10px_rgba(0,0,0,.8)]">
        <button onClick={() => set({ map2d: true })} aria-label="Open the full map" className="block">
          <canvas ref={ref} width={420} height={420} className="block h-[136px] w-[136px] sm:h-[210px] sm:w-[210px]" />
        </button>
        <span className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded bg-black/50 px-1 font-display text-[9px] font-bold text-white">N</span>
        <div className="absolute bottom-1.5 right-1.5 flex flex-col gap-1">
          {(["+", "−"] as const).map((l) => (
            <button key={l} onClick={() => setView(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(view) + (l === "+" ? -1 : 1)))])} className="grid h-6 w-6 place-items-center rounded-md border border-white/15 bg-black/60 text-xs text-ink hover:bg-black/80" aria-label={l === "+" ? "Zoom in" : "Zoom out"}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden items-center gap-3 rounded-lg bg-black/45 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur sm:flex">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: MAP.you }} /> you/home</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: MAP.resident }} /> neighbours</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm border" style={{ borderColor: MAP.open }} /> open land</span>
      </div>
    </div>
  );
}
