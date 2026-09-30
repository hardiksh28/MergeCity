"use client";

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import type { Look } from "@/lib/types";
import { FONT_BOLD } from "./fonts";

export interface AnimState {
  speed: number;
  grounded: boolean;
  wave?: boolean;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const G = {
  leg: box(0.2, 0.82, 0.22).translate(0, -0.41, 0),
  shoe: box(0.23, 0.12, 0.32).translate(0, -0.84, 0.04),
  torso: box(0.54, 0.62, 0.3).translate(0, 0.31, 0),
  belt: box(0.56, 0.05, 0.32).translate(0, 0.04, 0),
  arm: box(0.15, 0.55, 0.16).translate(0, -0.26, 0),
  hand: box(0.14, 0.13, 0.14).translate(0, -0.6, 0),
  head: box(0.42, 0.42, 0.38).translate(0, 0.23, 0),
  visor: box(0.36, 0.08, 0.03).translate(0, 0.27, 0.195),
  hairTop: box(0.45, 0.1, 0.41).translate(0, 0.47, 0),
  hairBack: box(0.45, 0.3, 0.08).translate(0, 0.32, -0.17),
  spike: new THREE.ConeGeometry(0.075, 0.26, 4).translate(0, 0.13, 0),
  mohawk: box(0.08, 0.2, 0.44).translate(0, 0.52, 0),
  capTop: box(0.45, 0.13, 0.41).translate(0, 0.48, 0),
  capBrim: box(0.42, 0.03, 0.22).translate(0, 0.43, 0.28),
  beanie: box(0.46, 0.2, 0.43).translate(0, 0.49, 0),
  pom: new THREE.SphereGeometry(0.07, 8, 6).translate(0, 0.63, 0),
  halo: new THREE.TorusGeometry(0.22, 0.025, 6, 24).rotateX(Math.PI / 2).translate(0, 0.66, 0),
  pack: box(0.36, 0.42, 0.14).translate(0, 0.32, -0.22),
};

export function Character({
  look,
  anim,
  name,
  highlight,
}: {
  look: Look;
  anim: { current: AnimState };
  name?: string;
  highlight?: boolean;
}) {
  const mats = useMemo(() => {
    const outfit = new THREE.Color(look.outfit);
    return {
      outfit: new THREE.MeshStandardMaterial({ color: outfit, emissive: outfit, emissiveIntensity: 0.18, roughness: 0.5, metalness: 0.2 }),
      skin: new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.8 }),
      pants: new THREE.MeshStandardMaterial({ color: "#16121f", roughness: 0.7 }),
      glow: new THREE.MeshBasicMaterial({ color: outfit.clone().multiplyScalar(3.2), toneMapped: false }),
      visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 3.2, 3.6), toneMapped: false }),
      hair: new THREE.MeshStandardMaterial({ color: "#120d18", roughness: 0.6 }),
      gold: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 0.8), toneMapped: false }),
      pack: new THREE.MeshStandardMaterial({ color: "#241b33", roughness: 0.6 }),
    };
  }, [look.outfit, look.skin]);

  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const phase = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const a = anim.current;
    const sp = a.speed;
    phase.current += dt * (2.6 + sp * 1.25);
    const amp = Math.min(sp / 5, 1.5) * 0.75;
    const s = Math.sin(phase.current);
    const lerp = 1 - Math.exp(-dt * 14);
    const set = (g: THREE.Group | null, x: number, z = 0) => {
      if (!g) return;
      g.rotation.x += (x - g.rotation.x) * lerp;
      g.rotation.z += (z - g.rotation.z) * lerp;
    };
    if (!a.grounded) {
      set(legL.current, -0.7);
      set(legR.current, 0.35);
      set(armL.current, -2.7, 0.2);
      set(armR.current, -2.7, -0.2);
    } else if (sp > 0.2) {
      set(legL.current, s * amp);
      set(legR.current, -s * amp);
      set(armL.current, -s * amp * 0.9, 0.05);
      set(armR.current, s * amp * 0.9, -0.05);
    } else {
      set(legL.current, 0);
      set(legR.current, 0);
      set(armL.current, Math.sin(t * 1.3) * 0.04, 0.08);
      if (a.wave) set(armR.current, 0, -2.6 + Math.sin(t * 9) * 0.35);
      else set(armR.current, -Math.sin(t * 1.3) * 0.04, -0.08);
    }
    if (body.current) {
      body.current.position.y = 0.9 + (sp > 0.2 && a.grounded ? Math.abs(s) * 0.07 * amp : Math.sin(t * 2) * 0.012);
      body.current.rotation.x = Math.min(sp / 9, 1) * 0.18;
    }
    if (head.current) head.current.rotation.y = sp > 0.2 ? 0 : Math.sin(t * 0.5) * 0.25;
  });

  const hw = look.head;
  return (
    <group>
      <group ref={body} position={[0, 0.9, 0]}>
        <group ref={legL} position={[-0.13, 0, 0]}>
          <mesh geometry={G.leg} material={mats.pants} />
          <mesh geometry={G.shoe} material={mats.glow} />
        </group>
        <group ref={legR} position={[0.13, 0, 0]}>
          <mesh geometry={G.leg} material={mats.pants} />
          <mesh geometry={G.shoe} material={mats.glow} />
        </group>
        <mesh geometry={G.torso} material={mats.outfit} />
        <mesh geometry={G.belt} material={mats.glow} />
        <mesh geometry={G.pack} material={mats.pack} />
        <group ref={armL} position={[-0.35, 0.58, 0]}>
          <mesh geometry={G.arm} material={mats.outfit} />
          <mesh geometry={G.hand} material={mats.skin} />
        </group>
        <group ref={armR} position={[0.35, 0.58, 0]}>
          <mesh geometry={G.arm} material={mats.outfit} />
          <mesh geometry={G.hand} material={mats.skin} />
        </group>
        <group ref={head} position={[0, 0.62, 0]}>
          <mesh geometry={G.head} material={mats.skin} />
          <mesh geometry={G.visor} material={mats.visor} />
          {hw === "short" && (
            <>
              <mesh geometry={G.hairTop} material={mats.hair} />
              <mesh geometry={G.hairBack} material={mats.hair} />
            </>
          )}
          {hw === "spiky" &&
            [-0.14, -0.05, 0.05, 0.14, 0].map((x, i) => (
              <mesh key={i} geometry={G.spike} material={i === 4 ? mats.glow : mats.hair} position={[x, 0.42, i === 4 ? -0.08 : (i % 2) * 0.1 - 0.05]} rotation={[0, 0, -x * 1.6]} />
            ))}
          {hw === "spiky" && <mesh geometry={G.hairTop} material={mats.hair} />}
          {hw === "mohawk" && <mesh geometry={G.mohawk} material={mats.glow} />}
          {hw === "cap" && (
            <>
              <mesh geometry={G.capTop} material={mats.outfit} />
              <mesh geometry={G.capBrim} material={mats.glow} />
            </>
          )}
          {hw === "beanie" && (
            <>
              <mesh geometry={G.beanie} material={mats.outfit} />
              <mesh geometry={G.pom} material={mats.glow} />
            </>
          )}
          {hw === "halo" && <mesh geometry={G.halo} material={mats.gold} />}
        </group>
      </group>
      {name && (
        <Suspense fallback={null}>
          <Billboard position={[0, 2.35, 0]}>
            <Text font={FONT_BOLD} fontSize={0.24} anchorY="middle" outlineWidth={0.015} outlineColor="#000" letterSpacing={0.04}>
              {name}
              <meshBasicMaterial toneMapped={false} color={highlight ? [1.6, 3, 0.4] : [2, 2, 2.2]} />
            </Text>
          </Billboard>
        </Suspense>
      )}
    </group>
  );
}
