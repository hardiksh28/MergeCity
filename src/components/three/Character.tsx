"use client";

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { RoundedBoxGeometry } from "three-stdlib";
import type { Look } from "@/lib/types";
import { FONT_BOLD } from "./fonts";

export interface AnimState {
  speed: number;
  grounded: boolean;
  wave?: boolean;
}

const rbox = (w: number, h: number, d: number, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, r);
const G = {
  leg: rbox(0.2, 0.74, 0.22, 0.07).translate(0, -0.37, 0),
  shoe: rbox(0.24, 0.13, 0.34, 0.05).translate(0, -0.8, 0.04),
  sole: new THREE.BoxGeometry(0.245, 0.035, 0.345).translate(0, -0.86, 0.04),
  torso: rbox(0.56, 0.64, 0.32, 0.1).translate(0, 0.32, 0),
  pocket: rbox(0.34, 0.14, 0.04, 0.02).translate(0, 0.14, 0.16),
  hood: rbox(0.46, 0.16, 0.22, 0.07).translate(0, 0.62, -0.1),
  arm: rbox(0.16, 0.52, 0.17, 0.07).translate(0, -0.24, 0),
  hand: rbox(0.15, 0.15, 0.15, 0.06).translate(0, -0.56, 0),
  neck: new THREE.CylinderGeometry(0.08, 0.09, 0.1, 10).translate(0, 0.02, 0),
  head: rbox(0.44, 0.44, 0.4, 0.12).translate(0, 0.25, 0),
  eye: new THREE.BoxGeometry(0.075, 0.09, 0.02),
  pupil: new THREE.BoxGeometry(0.04, 0.05, 0.01),
  brow: new THREE.BoxGeometry(0.09, 0.02, 0.015),
  mouth: new THREE.BoxGeometry(0.1, 0.02, 0.01),
  hairTop: rbox(0.47, 0.13, 0.43, 0.06).translate(0, 0.47, -0.005),
  hairBack: rbox(0.47, 0.3, 0.1, 0.04).translate(0, 0.33, -0.17),
  spike: new THREE.ConeGeometry(0.08, 0.24, 5).translate(0, 0.12, 0),
  mohawk: rbox(0.09, 0.2, 0.44, 0.04).translate(0, 0.54, 0),
  capTop: rbox(0.47, 0.15, 0.43, 0.07).translate(0, 0.48, 0),
  capBrim: rbox(0.42, 0.035, 0.22, 0.015).translate(0, 0.42, 0.28),
  beanie: rbox(0.48, 0.22, 0.45, 0.1).translate(0, 0.49, 0),
  pom: new THREE.SphereGeometry(0.075, 10, 8).translate(0, 0.64, 0),
  halo: new THREE.TorusGeometry(0.21, 0.022, 8, 28).rotateX(Math.PI / 2).translate(0, 0.66, 0),
  pack: rbox(0.36, 0.42, 0.14, 0.05).translate(0, 0.34, -0.22),
  shadow: new THREE.CircleGeometry(0.55, 24).rotateX(-Math.PI / 2),
};

const shadowMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(1.0, 0.1, d) * 0.55); }`,
});

const HAIR = "#2a1d17";

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
    const pants = new THREE.Color("#2a3140");
    return {
      outfit: new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.75, metalness: 0.05 }),
      trim: new THREE.MeshStandardMaterial({ color: outfit.clone().multiplyScalar(0.7), roughness: 0.8 }),
      skin: new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.65 }),
      pants: new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 }),
      shoe: new THREE.MeshStandardMaterial({ color: "#eef1f5", roughness: 0.6 }),
      sole: new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.5, emissive: outfit, emissiveIntensity: 0.25 }),
      eye: new THREE.MeshBasicMaterial({ color: "#f4f6fa" }),
      pupil: new THREE.MeshBasicMaterial({ color: "#16181f" }),
      hair: new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.7 }),
      gold: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.8), toneMapped: false }),
      pack: new THREE.MeshStandardMaterial({ color: "#39404f", roughness: 0.7 }),
      white: new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.7 }),
    };
  }, [look.outfit, look.skin]);

  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const blink = useRef(2);

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
      body.current.position.y = 0.86 + (sp > 0.2 && a.grounded ? Math.abs(s) * 0.07 * amp : Math.sin(t * 2) * 0.01);
      body.current.rotation.x = Math.min(sp / 9, 1) * 0.16;
    }
    if (head.current) head.current.rotation.y = sp > 0.2 ? 0 : Math.sin(t * 0.5) * 0.25;
    // blink every few seconds
    blink.current -= dt;
    if (eyes.current) eyes.current.scale.y = blink.current < 0.12 ? 0.1 : 1;
    if (blink.current < 0) blink.current = 2.5 + ((t * 7.3) % 3);
  });

  const hw = look.head;
  return (
    <group>
      <mesh geometry={G.shadow} material={shadowMat} position={[0, 0.02, 0]} renderOrder={1} />
      <group ref={body} position={[0, 0.86, 0]}>
        {[-1, 1].map((k) => (
          <group key={k} ref={k < 0 ? legL : legR} position={[k * 0.13, 0, 0]}>
            <mesh geometry={G.leg} material={mats.pants} />
            <mesh geometry={G.shoe} material={mats.shoe} />
            <mesh geometry={G.sole} material={mats.sole} />
          </group>
        ))}
        <mesh geometry={G.torso} material={mats.outfit} />
        <mesh geometry={G.pocket} material={mats.trim} />
        <mesh geometry={G.hood} material={mats.trim} />
        <mesh geometry={G.pack} material={mats.pack} />
        {[-1, 1].map((k) => (
          <group key={k} ref={k < 0 ? armL : armR} position={[k * 0.36, 0.58, 0]}>
            <mesh geometry={G.arm} material={mats.outfit} />
            <mesh geometry={G.hand} material={mats.skin} />
          </group>
        ))}
        <group ref={head} position={[0, 0.64, 0]}>
          <mesh geometry={G.neck} material={mats.skin} />
          <mesh geometry={G.head} material={mats.skin} />
          <group ref={eyes} position={[0, 0.27, 0.201]}>
            {[-1, 1].map((k) => (
              <group key={k} position={[k * 0.095, 0, 0]}>
                <mesh geometry={G.eye} material={mats.eye} />
                <mesh geometry={G.pupil} material={mats.pupil} position={[0, -0.01, 0.012]} />
              </group>
            ))}
          </group>
          {[-1, 1].map((k) => (
            <mesh key={k} geometry={G.brow} material={mats.hair} position={[k * 0.095, 0.345, 0.205]} rotation={[0, 0, k * -0.12]} />
          ))}
          <mesh geometry={G.mouth} material={mats.pupil} position={[0, 0.14, 0.203]} />
          {(hw === "short" || hw === "spiky") && (
            <>
              <mesh geometry={G.hairTop} material={mats.hair} />
              <mesh geometry={G.hairBack} material={mats.hair} />
            </>
          )}
          {hw === "spiky" &&
            [-0.14, -0.05, 0.05, 0.14, 0].map((x, i) => (
              <mesh key={i} geometry={G.spike} material={mats.hair} position={[x, 0.5, i === 4 ? -0.08 : (i % 2) * 0.1 - 0.05]} rotation={[0, 0, -x * 1.6]} />
            ))}
          {hw === "mohawk" && <mesh geometry={G.mohawk} material={mats.outfit} />}
          {hw === "cap" && (
            <>
              <mesh geometry={G.capTop} material={mats.outfit} />
              <mesh geometry={G.capBrim} material={mats.trim} />
            </>
          )}
          {hw === "beanie" && (
            <>
              <mesh geometry={G.beanie} material={mats.outfit} />
              <mesh geometry={G.pom} material={mats.white} />
            </>
          )}
          {hw === "halo" && <mesh geometry={G.halo} material={mats.gold} />}
        </group>
      </group>
      {name && (
        <Suspense fallback={null}>
          <Billboard position={[0, 2.35, 0]}>
            <Text font={FONT_BOLD} fontSize={0.22} anchorY="middle" outlineWidth={0.025} outlineColor="#050810" letterSpacing={0.03}>
              {name}
              <meshBasicMaterial toneMapped={false} color={highlight ? [0.9, 2.0, 1.0] : [1.4, 1.45, 1.6]} />
            </Text>
          </Billboard>
        </Suspense>
      )}
    </group>
  );
}
