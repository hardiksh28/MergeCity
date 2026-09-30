"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { PLOTS_BY_ID, doorPoint } from "@/lib/city";
import { rayDistance } from "@/lib/physics";
import { runtime, useCity } from "@/lib/store";

export const PEDESTAL = { x: 0, z: 9.5 };

const pos = new THREE.Vector3();
const look = new THREE.Vector3();
const curLook = new THREE.Vector3(0, 40, 0);
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();

function damp(v: THREE.Vector3, to: THREE.Vector3, lambda: number, dt: number) {
  v.lerp(to, 1 - Math.exp(-lambda * dt));
}

export function CameraRig() {
  const { camera, size } = useThree();
  const phase = useCity((s) => s.phase);
  const flight = useRef<{ from: THREE.Vector3; fromLook: THREE.Vector3; t: number; dur: number; plotId: string } | null>(null);
  const flyT = useRef(0);

  // Put the character where each phase needs it.
  useEffect(() => {
    const s = useCity.getState();
    if (phase === "join" || phase === "verify" || phase === "landing") {
      runtime.teleport = { x: PEDESTAL.x, z: PEDESTAL.z, facing: 0 };
    }
    if (phase === "movein" && s.me) {
      const p = PLOTS_BY_ID.get(s.me.plotId)!;
      const d = doorPoint(p, 1.6);
      const facing = (p.face * Math.PI) / 2;
      runtime.teleport = { x: d.x, z: d.z, facing, camYaw: facing + 0.35 };
      flight.current = { from: camera.position.clone(), fromLook: curLook.clone(), t: 0, dur: 5.2, plotId: p.id };
    }
  }, [phase, camera]);

  // A founder upgrade relocates the house: fly there too.
  const camFocus = useCity((s) => s.camFocus);
  useEffect(() => {
    if (!camFocus) return;
    const p = PLOTS_BY_ID.get(camFocus.plotId);
    if (!p) return;
    const d = doorPoint(p, 1.6);
    const facing = (p.face * Math.PI) / 2;
    runtime.teleport = { x: d.x, z: d.z, facing, camYaw: facing + 0.35 };
  }, [camFocus]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = useCity.getState();
    const cam = camera as THREE.PerspectiveCamera;
    const portrait = size.width < size.height;

    if (s.phase === "landing" || (s.map2d && s.phase !== "explore")) {
      flyT.current += dt * 0.035;
      const ang = flyT.current + 0.6;
      const r = portrait ? 300 : 250;
      pos.set(Math.sin(ang) * r, 125 + Math.sin(flyT.current * 1.7) * 25, Math.cos(ang) * r);
      look.set(0, portrait ? 45 : 25, 0);
      damp(cam.position, pos, 1.6, dt);
      damp(curLook, look, 1.6, dt);
      cam.lookAt(curLook);
      return;
    }

    if (s.phase === "join" || s.phase === "verify") {
      // Character creator shot on the plaza pedestal.
      if (portrait) {
        pos.set(PEDESTAL.x, 2.2, PEDESTAL.z + 6.2);
        look.set(PEDESTAL.x, 0.2, PEDESTAL.z);
      } else {
        pos.set(PEDESTAL.x - 1.3, 1.55, PEDESTAL.z + 4.6);
        look.set(PEDESTAL.x - 1.55, 1.05, PEDESTAL.z);
      }
      damp(cam.position, pos, 2.2, dt);
      damp(curLook, look, 2.6, dt);
      cam.lookAt(curLook);
      return;
    }

    if (s.phase === "movein" && flight.current) {
      const f = flight.current;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      const p = PLOTS_BY_ID.get(f.plotId)!;
      const door = doorPoint(p, 1.6);
      // Final shot: in front of the house, looking back at the door.
      c.set(door.x + p.face * 7, 3.2, door.z + p.gardenSide * 3.5);
      b.set((f.from.x + c.x) / 2, 160, (f.from.z + c.z) / 2); // arc over the city
      a.copy(f.from);
      // quadratic bezier
      pos.set(0, 0, 0)
        .addScaledVector(a, (1 - e) ** 2)
        .addScaledVector(b, 2 * (1 - e) * e)
        .addScaledVector(c, e * e);
      look.set(door.x, 1.4, door.z);
      const lookMix = Math.min(1, e * 1.6);
      curLook.copy(f.fromLook).lerp(look, lookMix);
      cam.position.copy(pos);
      cam.lookAt(curLook);
      return;
    }

    // Third-person follow with collision.
    const R = runtime;
    R.camYaw -= R.look.dx * 0.0055;
    R.camPitch = THREE.MathUtils.clamp(R.camPitch + R.look.dy * 0.004, -0.15, 1.35);
    R.look.dx = R.look.dy = 0;
    const tx = R.pos.x;
    const ty = R.pos.y + 1.55;
    const tz = R.pos.z;
    const cp = Math.cos(R.camPitch);
    const dx = Math.sin(R.camYaw) * cp;
    const dy = Math.sin(R.camPitch);
    const dz = Math.cos(R.camYaw) * cp;
    const want = R.camDist * (portrait ? 1.35 : 1);
    let dist = rayDistance(tx, ty, tz, dx, dy, dz, want);
    if (dist < want) dist = Math.max(0.8, dist - 0.35);
    pos.set(tx + dx * dist, Math.max(0.35, ty + dy * dist), tz + dz * dist);
    look.set(tx, ty, tz);
    const snap = cam.position.distanceTo(pos) > 400;
    if (snap) cam.position.copy(pos);
    else damp(cam.position, pos, dist < want ? 30 : cam.position.distanceTo(pos) > 30 ? 3 : 10, dt);
    damp(curLook, look, snap ? 1000 : cam.position.distanceTo(pos) > 30 ? 4 : 18, dt);
    cam.lookAt(curLook);
    void clock;
  });

  return null;
}
