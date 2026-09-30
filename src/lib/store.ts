"use client";

import { create } from "zustand";
import type { Look, Me, PublicResident, Team } from "./types";

export type Phase = "landing" | "join" | "verify" | "movein" | "explore";
export type Quality = "high" | "low";

export type Panel =
  | { type: "neighbour"; id: string }
  | { type: "house" }
  | { type: "vacant"; plotId: string }
  | { type: "tower"; towerId: string }
  | { type: "hq" }
  | { type: "pay" }
  | { type: "team"; towerId?: string }
  | null;

export interface Prompt {
  key: string;
  verb: string;
  label: string;
  panel: Exclude<Panel, null>;
}

export interface Toast {
  id: number;
  text: string;
  tone?: "info" | "good" | "gold";
}

export interface Arrival {
  plotId: string;
  at: number;
}

interface State {
  phase: Phase;
  quality: Quality;
  map2d: boolean;
  webgl: boolean;
  sceneReady: boolean;
  progress: number;
  isTouch: boolean;

  residents: PublicResident[];
  teams: Team[];
  me: Me | null;
  guest: boolean;
  draftLook: Look;
  ref: string | null;

  panel: Panel;
  prompt: Prompt | null;
  toasts: Toast[];
  arrivals: Arrival[];
  launch: boolean;
  camFocus: { plotId: string; at: number } | null;
  welcome: string | null;

  set: (p: Partial<State>) => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
  arrive: (plotId: string) => void;
}

let toastId = 0;

export const useCity = create<State>((set, get) => ({
  phase: "landing",
  quality: "high",
  map2d: false,
  webgl: true,
  sceneReady: false,
  progress: 0,
  isTouch: false,

  residents: [],
  teams: [],
  me: null,
  guest: false,
  draftLook: { outfit: "#ff2bd6", skin: "#c98e62", head: "spiky" },
  ref: null,

  panel: null,
  prompt: null,
  toasts: [],
  arrivals: [],
  launch: false,
  camFocus: null,
  welcome: null,

  set: (p) => set(p),
  toast: (text, tone = "info") => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 5200);
  },
  arrive: (plotId) => {
    const at = performance.now();
    set({ arrivals: [...get().arrivals.filter((a) => at - a.at < 4000), { plotId, at }] });
  },
}));

/**
 * Per-frame mutable state. Kept out of React so 60fps input and movement
 * never trigger re-renders.
 */
export const runtime = {
  pos: { x: 0, y: 0, z: 0 },
  facing: 0,
  speed: 0,
  grounded: true,
  camYaw: 0,
  camPitch: 0.35,
  camDist: 8,
  keys: new Set<string>(),
  joy: { x: 0, y: 0 },
  look: { dx: 0, dy: 0 },
  jump: false,
  run: false,
  teleport: null as null | { x: number; z: number; facing: number; camYaw?: number },
};
