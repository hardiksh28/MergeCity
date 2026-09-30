"use client";

import { useEffect, useState } from "react";
import { CITY, DISTRICT_META, PLOTS_BY_ID } from "@/lib/city";

const MAIN_STREET_PLOTS = CITY.plots.filter((p) => p.district === "mainstreet").length;
import { runtime, useCity } from "@/lib/store";
import { Deed } from "./Deed";

export function MoveIn() {
  const me = useCity((s) => s.me);
  const map2d = useCity((s) => s.map2d);
  const set = useCity((s) => s.set);
  const [landed, setLanded] = useState(map2d);

  useEffect(() => {
    if (map2d) return;
    const t = setTimeout(() => setLanded(true), 5000);
    return () => clearTimeout(t);
  }, [map2d]);

  if (!me) return null;
  const p = PLOTS_BY_ID.get(me.plotId)!;
  const meta = DISTRICT_META[p.district];

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* cinematic letterbox */}
      <div className={`absolute inset-x-0 top-0 bg-black transition-all duration-700 ${landed ? "h-0" : "h-[9vh]"}`} />
      <div className={`absolute inset-x-0 bottom-0 bg-black transition-all duration-700 ${landed ? "h-0" : "h-[9vh]"}`} />
      {!landed && (
        <p className="absolute bottom-[11vh] left-1/2 -translate-x-1/2 font-mono text-xs uppercase tracking-[0.3em] text-muted">
          Moving you in<span className="animate-pulse">…</span>
        </p>
      )}
      {landed && (
        <div className="absolute inset-0 flex items-end justify-center p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-10">
          <div className="glass sheet-in pointer-events-auto w-full max-w-[460px] rounded-3xl p-6 text-center sm:p-8">
            <p className="label" style={{ color: meta.color }}>
              {meta.name} · #{me.place} on the waitlist
            </p>
            <h2 className="mt-3 font-display text-[1.7rem] font-black leading-tight tracking-tight sm:text-3xl">
              Welcome to MergeCity,
              <br />
              <span className="neon-text" style={{ color: meta.color }}>
                Plot {p.num}.
              </span>
            </h2>
            <p className="mt-3 text-sm text-muted">
              This land is registered to you. Plot numbers are addresses, not your place in the queue: Main Street (plots 1–{MAIN_STREET_PLOTS}) is kept for founding residents. The green beacon marks your house, and every teammate who joins with your link adds a floor.
            </p>
            <div className="mt-4">
              <Deed r={me} compact />
            </div>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <button className="btn btn-primary flex-1" onClick={() => { runtime.camYaw = runtime.facing + 0.35; set({ phase: "explore", panel: { type: "house" } }); }}>
                Get my invite link
              </button>
              <button className="btn btn-ghost flex-1" onClick={() => { runtime.camYaw = runtime.facing + 0.35; set({ phase: "explore" }); }}>
                Explore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
