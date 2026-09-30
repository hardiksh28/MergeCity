"use client";

import { useMemo, useState } from "react";
import { spawnAtHome } from "@/lib/interact";
import { useCity } from "@/lib/store";
import { PLOTS_BY_ID, plotLabel } from "@/lib/city";
import { Logo } from "./Logo";
import { BackButton } from "./BackButton";

export function Landing() {
  const residents = useCity((s) => s.residents);
  const me = useCity((s) => s.me);
  const welcome = useCity((s) => s.welcome);
  const progress = useCity((s) => s.progress);
  const sceneReady = useCity((s) => s.sceneReady);
  const map2d = useCity((s) => s.map2d);
  const webgl = useCity((s) => s.webgl);
  const set = useCity((s) => s.set);

  const [now] = useState(() => Date.now());
  const today = useMemo(() => residents.filter((r) => now - r.joinedAt < 864e5).length, [residents, now]);

  const enter = () => {
    spawnAtHome();
    set({ phase: "explore", guest: !me, welcome: null });
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <header className="pointer-events-auto relative z-20 flex items-center justify-between gap-3 p-4 sm:p-6">
        {map2d && webgl ? <BackButton label="Back to 3D city" /> : <Logo />}
        <div className="flex items-center gap-2">
          <span className="chip hidden sm:inline-flex">
            <span className="live-dot" /> {residents.length.toLocaleString("en-IN")} plots registered
          </span>
          {webgl && (
            <button className="chip hover:text-ink" onClick={() => set({ map2d: !map2d })}>
              {map2d ? "3D city" : "2D map"}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1" />

      <section className="pointer-events-auto relative isolate px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-10 sm:pb-12">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[150%] bg-gradient-to-t from-[#060a14] via-[#060a14d9] to-transparent sm:hidden" />
        <div className="pointer-events-none absolute -bottom-10 -left-40 -z-10 hidden h-[160%] w-[1100px] sm:block" style={{ background: "radial-gradient(closest-side, rgba(5,2,12,.92), rgba(5,2,12,.7) 45%, transparent)" }} />
        <div className="max-w-[640px]">
          {welcome && me ? (
            <p className="rise mb-4 inline-flex items-start gap-2 rounded-xl border border-lime/30 bg-lime/10 px-3 py-2 text-sm text-lime">
              <span className="mt-[5px] live-dot shrink-0" />
              {welcome}
            </p>
          ) : (
            <span className="rise chip mb-4 !text-cyan" style={{ animationDelay: "0.05s" }}>
              MergeMate waitlist · Season 0
            </span>
          )}
          <h1 className="rise font-display text-[2.6rem] font-black leading-[0.95] tracking-tight sm:text-7xl" style={{ animationDelay: "0.1s" }}>
            {me ? (
              <>
                Welcome home,
                <br />
                <span className="bg-gradient-to-r from-blue via-[#9fdcff] to-cyan bg-clip-text text-transparent">{me.handle}.</span>
              </>
            ) : (
              <>
                Claim your plot
                <br />
                <span className="bg-gradient-to-r from-blue via-[#9fdcff] to-cyan bg-clip-text text-transparent">in MergeCity.</span>
              </>
            )}
          </h1>
          <p className="rise mt-4 max-w-[520px] text-[15px] leading-relaxed text-muted sm:text-lg" style={{ animationDelay: "0.18s" }}>
            {me
              ? `${plotLabel(PLOTS_BY_ID.get(me.plotId)!)} · #${me.place} in line · ${me.floors} floor${me.floors > 1 ? "s" : ""}.`
              : "Join the MergeMate waitlist and a plot of land in MergeCity is registered in your name. Build your character, get your house, invite teammates to stack floors."}
          </p>
          <div className="rise mt-6 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.26s" }}>
            {me ? (
              <button className="btn btn-primary text-sm" onClick={enter}>
                Enter the city <span aria-hidden>→</span>
              </button>
            ) : (
              <>
                <button className="btn btn-primary text-sm sm:px-8" onClick={() => set({ phase: "join" })}>
                  Move in <span aria-hidden>→</span>
                </button>
                <button className="btn btn-ghost" onClick={enter}>
                  Look around first
                </button>
              </>
            )}
          </div>
          <div className="rise mt-5 flex items-center gap-2 font-mono text-xs text-dim sm:hidden" style={{ animationDelay: "0.3s" }}>
            <span className="live-dot" /> {residents.length.toLocaleString("en-IN")} plots registered · {today} today
          </div>
        </div>

        <TierLadder />
      </section>

      {webgl && !map2d && !sceneReady && (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/5">
          <div className="h-full bg-gradient-to-r from-blue to-cyan transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%`, boxShadow: "0 0 12px #5b7cff" }} />
          <span className="absolute bottom-2 right-4 font-mono text-[10px] uppercase tracking-widest text-dim">Rendering city · {Math.round(progress * 100)}%</span>
        </div>
      )}
    </div>
  );
}

function TierLadder() {
  const rows = [
    { c: "#7ee787", t: "Outskirts", d: "Free plot + house. Lights off." },
    { c: "#e9eef7", t: "+1 floor", d: "Per teammate who verifies. Up to 5." },
    { c: "#4fd1ff", t: "Main Street", d: "₹9 via UPI. Lights on, flag up." },
    { c: "#ffc15e", t: "Team tower", d: "Downtown. A lit floor per paid seat." },
  ];
  return (
    <ol className="glass rise absolute bottom-12 right-10 hidden w-[300px] rounded-2xl p-4 lg:block" style={{ animationDelay: "0.4s" }}>
      <li className="label mb-3">How your house grows</li>
      {rows.map((r, i) => (
        <li key={r.t} className="flex items-start gap-3 py-1.5">
          <span className="mt-1 font-mono text-[10px] text-dim">0{i + 1}</span>
          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-sm" style={{ background: r.c, boxShadow: `0 0 10px ${r.c}` }} />
          <span className="text-sm leading-snug">
            <b className="font-semibold">{r.t}</b> <span className="text-muted">{r.d}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
