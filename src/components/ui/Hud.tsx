"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DISTRICT_META, PLOTS_BY_ID, districtAt } from "@/lib/city";
import { interact, spawnAtHome } from "@/lib/interact";
import { renderCityCanvas } from "@/lib/mapdraw";
import { runtime, useCity } from "@/lib/store";
import { Joystick } from "./Joystick";
import { Logo } from "./Logo";

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
      <div className="absolute left-3 top-3 flex flex-col items-start gap-2 sm:left-5 sm:top-5">
        <button className="pointer-events-auto" onClick={() => set({ phase: "landing", panel: null, prompt: null })} aria-label="Back to the flyover">
          <Logo small />
        </button>
        <div key={district} className="chip rise !py-1" style={{ color: meta.color, borderColor: meta.color + "55" }}>
          ◆ {meta.name}
        </div>
        {plot && (
          <button className="chip pointer-events-auto hover:text-ink" onClick={() => set({ panel: { type: "house" } })}>
            🏠 Plot {plot.num} · {me!.floors}F
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
            <a className="block w-full rounded-lg px-3 py-2 text-left text-muted hover:bg-white/5" href="/admin">
              Admin (demo)
            </a>
          </div>
        )}
      </div>

      {/* interaction prompt */}
      {prompt && !panel && !map2d && (
        <div className={`absolute left-1/2 -translate-x-1/2 ${isTouch ? "bottom-[190px]" : "bottom-10"}`}>
          <button key={prompt.key} className="glass sheet-in pointer-events-auto flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5" onClick={interact}>
            <span className="kbd !h-8 !min-w-8 !text-sm text-lime" style={{ borderColor: "#b6ff3b88" }}>{isTouch ? "●" : "E"}</span>
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
          className="grid h-20 w-20 place-items-center rounded-full border border-pink/60 bg-pink/15 font-display text-xs font-bold tracking-wider text-pink backdrop-blur active:scale-95"
          onPointerDown={(e) => { e.stopPropagation(); runtime.jump = true; }}
        >
          JUMP
        </button>
      </div>
    </>
  );
}

function Minimap() {
  const residents = useCity((s) => s.residents);
  const teams = useCity((s) => s.teams);
  const meId = useCity((s) => s.me?.id);
  const launch = useCity((s) => s.launch);
  const set = useCity((s) => s.set);
  const ref = useRef<HTMLCanvasElement>(null);
  const city = useMemo(() => renderCityCanvas(residents, teams, { ppu: 2, meId, launch }), [residents, teams, meId, launch]);

  useEffect(() => {
    let raf = 0;
    const cv = ref.current!;
    const g = cv.getContext("2d")!;
    const S = cv.width;
    const view = 70; // world units from centre to edge
    const draw = () => {
      const { x, z } = runtime.pos;
      const k = S / (view * 2);
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = "#07030f";
      g.fillRect(0, 0, S, S);
      const sx = (x - view + city.extent) * city.ppu;
      const sz = (z - view + city.extent) * city.ppu;
      g.drawImage(city.canvas, sx, sz, view * 2 * city.ppu, view * 2 * city.ppu, 0, 0, S, S);
      // view cone
      const yaw = runtime.camYaw + Math.PI;
      g.fillStyle = "rgba(34,243,255,0.12)";
      g.beginPath();
      g.moveTo(S / 2, S / 2);
      g.arc(S / 2, S / 2, S * 0.4, Math.atan2(Math.cos(yaw), Math.sin(yaw)) - 0.5, Math.atan2(Math.cos(yaw), Math.sin(yaw)) + 0.5);
      g.fill();
      // player arrow
      g.translate(S / 2, S / 2);
      g.rotate(-runtime.facing + Math.PI);
      g.fillStyle = "#b6ff3b";
      g.shadowColor = "#b6ff3b";
      g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(0, -9 * (S / 180));
      g.lineTo(6 * (S / 180), 7 * (S / 180));
      g.lineTo(0, 3 * (S / 180));
      g.lineTo(-6 * (S / 180), 7 * (S / 180));
      g.closePath();
      g.fill();
      g.restore();
      void k;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [city]);

  return (
    <button onClick={() => set({ map2d: true })} className="pointer-events-auto relative rounded-full" aria-label="Open the full map" style={{ boxShadow: "0 0 0 1px rgba(255,43,214,.5), 0 0 30px -4px rgba(255,43,214,.6)" }}>
      <canvas ref={ref} width={360} height={360} className="h-[118px] w-[118px] rounded-full sm:h-[170px] sm:w-[170px]" />
      <span className="absolute left-1/2 top-1 -translate-x-1/2 font-mono text-[9px] text-muted">N</span>
    </button>
  );
}
