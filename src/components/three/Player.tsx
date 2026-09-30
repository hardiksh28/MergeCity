"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PLOTS_BY_ID, doorPoint } from "@/lib/city";
import { findPrompt, knock } from "@/lib/interact";
import { resolveCircle } from "@/lib/physics";
import { runtime, useCity } from "@/lib/store";
import type { PublicResident } from "@/lib/types";
import { Character, type AnimState } from "./Character";

const GRAVITY = 26;
const JUMP_V = 9;
const WALK = 5.2;
const RUN = 10;

export function Player() {
  const me = useCity((s) => s.me);
  const draft = useCity((s) => s.draftLook);
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const anim = useRef<AnimState>({ speed: 0, grounded: true });
  const vel = useRef({ x: 0, y: 0, z: 0 });
  const lastPrompt = useRef(0);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = useCity.getState();
    const R = runtime;
    const v = vel.current;

    if (R.teleport) {
      R.pos.x = R.teleport.x;
      R.pos.z = R.teleport.z;
      R.pos.y = 0;
      R.facing = R.teleport.facing;
      R.camYaw = R.teleport.camYaw ?? R.facing + Math.PI;
      v.x = v.y = v.z = 0;
      R.teleport = null;
    }

    const canMove = s.phase === "explore" && !s.panel;
    let ix = 0;
    let iz = 0;
    if (canMove) {
      const k = R.keys;
      const fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) - R.joy.y;
      const str = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + R.joy.x;
      const sy = Math.sin(R.camYaw);
      const cy = Math.cos(R.camYaw);
      ix = -sy * fwd + cy * str;
      iz = -cy * fwd - sy * str;
      const len = Math.hypot(ix, iz);
      if (len > 1) {
        ix /= len;
        iz /= len;
      }
    }
    const inputLen = Math.hypot(ix, iz);
    const running = R.run || R.keys.has("shift") || Math.hypot(R.joy.x, R.joy.y) > 0.92;
    const target = (running ? RUN : WALK) * inputLen;
    const accel = 1 - Math.exp(-dt * (R.grounded ? 12 : 3));
    const tx = inputLen > 0 ? (ix / inputLen) * target : 0;
    const tz = inputLen > 0 ? (iz / inputLen) * target : 0;
    v.x += (tx - v.x) * accel;
    v.z += (tz - v.z) * accel;

    if (canMove && R.jump && R.grounded) {
      v.y = JUMP_V;
      R.grounded = false;
    }
    R.jump = false;
    v.y -= GRAVITY * dt;

    R.pos.x += v.x * dt;
    R.pos.z += v.z * dt;
    R.pos.y += v.y * dt;
    if (R.pos.y <= 0) {
      R.pos.y = 0;
      v.y = 0;
      R.grounded = true;
    }
    resolveCircle(R.pos, 0.42);

    const hs = Math.hypot(v.x, v.z);
    if (hs > 0.3) {
      const want = Math.atan2(v.x, v.z);
      let d = want - R.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      R.facing += d * (1 - Math.exp(-dt * 14));
    }
    if (s.phase === "join" || s.phase === "verify" || s.phase === "landing") {
      R.facing += dt * 0.6; // turntable in the character creator
    }
    R.speed = hs;
    anim.current.speed = hs;
    anim.current.grounded = R.grounded;

    if (group.current) {
      group.current.position.set(R.pos.x, R.pos.y, R.pos.z);
      group.current.rotation.y = R.facing;
    }
    if (light.current) {
      light.current.position.set(R.pos.x, R.pos.y + 3.2, R.pos.z);
      light.current.intensity = 14 + Math.sin(clock.elapsedTime * 2) * 2;
    }

    if (s.phase === "explore" && clock.elapsedTime - lastPrompt.current > 0.1) {
      lastPrompt.current = clock.elapsedTime;
      const p = findPrompt(R.pos.x, R.pos.z);
      if ((p?.key ?? null) !== (s.prompt?.key ?? null) || p?.verb !== s.prompt?.verb) s.set({ prompt: p });
    }
  });

  const look = me?.look ?? draft;
  return (
    <>
      <group ref={group}>
        <Character look={look} anim={anim} name={me ? me.handle : undefined} highlight />
      </group>
      <pointLight ref={light} color={look.outfit} distance={14} decay={1.6} intensity={14} />
    </>
  );
}

/** Residents standing at their doors near the player. Picked every half second. */
export function Neighbours() {
  const residents = useCity((s) => s.residents);
  const meId = useCity((s) => s.me?.id);
  const [near, setNear] = useState<PublicResident[]>([]);
  const t = useRef(0);

  useFrame(({ camera }, dt) => {
    t.current -= dt;
    if (t.current > 0) return;
    t.current = 0.5;
    const cx = useCity.getState().phase === "explore" ? runtime.pos.x : camera.position.x;
    const cz = useCity.getState().phase === "explore" ? runtime.pos.z : camera.position.z;
    const list = residents
      .filter((r) => r.id !== meId)
      .map((r) => {
        const p = PLOTS_BY_ID.get(r.plotId)!;
        return { r, d: p ? Math.hypot(p.x - cx, p.z - cz) : 1e9 };
      })
      .filter((x) => x.d < 48)
      .sort((a, b) => a.d - b.d)
      .slice(0, 10)
      .map((x) => x.r);
    const same = list.length === near.length && list.every((r, i) => r === near[i]);
    if (!same) setNear(list);
  });

  return (
    <>
      {near.map((r) => (
        <Neighbour key={r.id} r={r} />
      ))}
    </>
  );
}

function Neighbour({ r }: { r: PublicResident }) {
  const p = PLOTS_BY_ID.get(r.plotId)!;
  const d = doorPoint(p, 0.9);
  const anim = useRef<AnimState>({ speed: 0, grounded: true, wave: false });
  useFrame(() => {
    anim.current.wave = knock.id === r.id && performance.now() - knock.at < 4000;
  });
  return (
    <group position={[d.x, 0, d.z]} rotation={[0, (p.face * Math.PI) / 2, 0]}>
      <Character look={r.look} anim={anim} name={r.handle} />
    </group>
  );
}
