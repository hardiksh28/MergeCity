"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, type ReactNode } from "react";
import { backend } from "@/lib/backend";
import type { PublicResident } from "@/lib/types";
import { PLOTS_BY_ID, plotLabel } from "@/lib/city";
import { interact } from "@/lib/interact";
import { goBack, installBackButton } from "@/lib/nav";
import { runtime, useCity } from "@/lib/store";
import { Landing } from "./ui/Landing";
import { JoinFlow } from "./ui/JoinFlow";
import { MoveIn } from "./ui/MoveIn";
import { Hud } from "./ui/Hud";
import { Panels } from "./ui/Panels";
import { Map2D } from "./ui/Map2D";
import { Toasts } from "./ui/Toasts";

const Scene = dynamic(() => import("./three/Scene"), { ssr: false, loading: () => null });

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    useCity.getState().set({ webgl: false, map2d: true });
    useCity.getState().toast("3D couldn't start on this device. Here's the 2D map.");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function detect() {
  let webgl = false;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {}
  const isTouch = matchMedia("(pointer: coarse)").matches;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const weak = mem <= 2 || (isTouch && (mem <= 4 || cores <= 4));
  const veryWeak = mem <= 1 || cores <= 2;
  return { webgl, isTouch, quality: weak ? ("low" as const) : ("high" as const), suggest2d: !webgl || veryWeak };
}

function refresh() {
  const { residents, teams } = backend.city();
  useCity.getState().set({ residents, teams, me: backend.me() });
}

export default function App() {
  const phase = useCity((s) => s.phase);
  const map2d = useCity((s) => s.map2d);
  const webgl = useCity((s) => s.webgl);
  const sceneReady = useCity((s) => s.sceneReady);
  const panel = useCity((s) => s.panel);
  const wrap = useRef<HTMLDivElement>(null);

  // Boot: device checks, URL flags, data, return-visit diff.
  useEffect(() => {
    const d = detect();
    const q = new URLSearchParams(location.search);
    const ref = q.get("ref") || (() => { try { return sessionStorage.getItem("mergecity:ref"); } catch { return null; } })();
    if (q.get("ref")) try { sessionStorage.setItem("mergecity:ref", q.get("ref")!); } catch {}
    const quality = (q.get("q") as "high" | "low") || d.quality;
    useCity.getState().set({
      isTouch: d.isTouch,
      webgl: d.webgl,
      quality,
      map2d: d.suggest2d || q.get("map") === "1",
      launch: q.get("launch") === "1",
      ref,
      progress: 0.1,
    });
    backend.catchUp();
    refresh();
    const unsub = backend.subscribe(refresh);
    // The live backend loads the session and city over the network first.
    backend.whenReady().then(() => {
      refresh();
      const diff = backend.diffSinceLastVisit();
      const me = backend.me();
      if (me && diff) {
        const bits = [];
        if (diff.newNeighbours) bits.push(`${diff.newNeighbours} new neighbour${diff.newNeighbours > 1 ? "s" : ""}`);
        if (diff.floorsGained) bits.push(`you gained ${diff.floorsGained} floor${diff.floorsGained > 1 ? "s" : ""}`);
        if (diff.upgraded) bits.push("your house moved");
        useCity.getState().set({
          welcome: bits.length ? `Welcome back, ${me.handle}. Since last time: ${bits.join(", ")}.` : `Welcome back, ${me.handle}. The lights are as you left them.`,
        });
      }
      backend.markSeen();
    });
    const onHide = () => document.visibilityState === "hidden" && backend.markSeen();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", backend.markSeen);
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", backend.markSeen);
    };
  }, []);

  // Phone / browser back button closes the top-most layer.
  useEffect(() => installBackButton(), []);

  // Someone new moves in: real signups over Realtime, or simulated ones in the demo.
  useEffect(() => {
    const show = (r: PublicResident) => {
      const p = PLOTS_BY_ID.get(r.plotId);
      if (!p) return;
      useCity.getState().toast(`${r.handle} registered ${plotLabel(p)}`, r.tier === "founder" ? "gold" : "info");
      useCity.getState().arrive(r.plotId);
    };
    if (!backend.demo) return backend.onArrival(show);
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        const r = backend.arrival();
        if (r) show(r);
        loop();
      }, 45000 + Math.random() * 60000);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // Keyboard
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      const s = useCity.getState();
      if (k === "escape") {
        goBack();
        return;
      }
      if (s.phase !== "explore") return;
      if (k === "e" || k === "enter") interact();
      if (k === " ") {
        runtime.jump = true;
        e.preventDefault();
      }
      if (k === "m") s.set({ map2d: !s.map2d });
      runtime.keys.add(k);
    };
    const up = (e: KeyboardEvent) => runtime.keys.delete(e.key.toLowerCase());
    const blur = () => runtime.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Drag to look, wheel/pinch to zoom.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const onDown = (e: PointerEvent) => {
      if (useCity.getState().phase !== "explore") return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      if (pts.size === 2) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) runtime.camDist = Math.min(20, Math.max(3.5, runtime.camDist * (pinch / d)));
        pinch = d;
        return;
      }
      const k = e.pointerType === "touch" ? 1.4 : 1;
      runtime.look.dx += (e.clientX - prev.x) * k;
      runtime.look.dy += (e.clientY - prev.y) * k;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (useCity.getState().phase !== "explore") return;
      runtime.camDist = Math.min(20, Math.max(3.5, runtime.camDist * (1 + e.deltaY * 0.0012)));
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    if (panel) runtime.keys.clear();
  }, [panel]);

  const show3d = webgl && !map2d;

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg select-none">
      {/* Painted instantly, before any 3D arrives. */}
      <div className={`absolute inset-0 overflow-hidden scan-bg transition-opacity duration-[1400ms] ${show3d && sceneReady ? "opacity-0" : "opacity-100"}`}>
        <div className="stars absolute inset-0" />
        <div className="moon absolute right-[16%] top-[12%] h-[9vmin] w-[9vmin] rounded-full" />
        <div className="absolute inset-x-0 bottom-0 h-[28%]" style={{ background: "linear-gradient(180deg, transparent, #07120c 60%)" }} />
      </div>

      <div ref={wrap} className="absolute inset-0 touch-none" style={{ cursor: phase === "explore" ? "grab" : "default" }}>
        {show3d && (
          <GLBoundary>
            <Scene />
          </GLBoundary>
        )}
      </div>

      {map2d && <Map2D />}

      {phase === "landing" && <Landing />}
      {(phase === "join" || phase === "verify") && <JoinFlow />}
      {phase === "movein" && <MoveIn />}
      {phase === "explore" && <Hud />}
      <Panels />
      <Toasts />
    </main>
  );
}
