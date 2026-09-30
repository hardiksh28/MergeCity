"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { CITY, HQ, TOWER_FLOOR_H, type TowerSlot } from "@/lib/city";
import { useCity } from "@/lib/store";
import type { Team } from "@/lib/types";
import { buildInstanced, place, rgb, unitBox } from "./instancing";
import { makeBuildingMaterial, makeGlowMaterial, makeHoloMaterial, shared } from "./shaders";
import { FONT_DISPLAY, FONT_MONO } from "./fonts";

const towerMat = makeBuildingMaterial({ winW: 2.1, winH: TOWER_FLOOR_H, glass: true });
const hqMat = makeBuildingMaterial({ winW: 1.6, winH: 3.2, glass: true });
const glowMat = makeGlowMaterial();
const litMat = makeGlowMaterial({ lit: true });

const blinkMat = new THREE.ShaderMaterial({
  uniforms: { uTime: shared.uTime },
  vertexShader: /* glsl */ `
    uniform float uTime; varying float vOn;
    void main(){
      float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
      vOn = 0.1 + 0.9 * step(0.6, fract(uTime * 0.5 + ph));
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `varying float vOn; void main(){ gl_FragColor = vec4(vec3(3.0, 0.35, 0.3) * vOn, 1.0); }`,
});

const crownH = (t: TowerSlot) => 5 + (t.num % 3) * 3;

export function Downtown() {
  const teams = useCity((s) => s.teams);
  const launch = useCity((s) => s.launch);

  const meshes = useMemo(() => {
    const claimed = new Map(teams.map((t) => [t.towerId, t]));
    const built = CITY.towers.filter((t) => claimed.has(t.id));
    const open = CITY.towers.filter((t) => !claimed.has(t.id));

    const bodies = buildInstanced(unitBox, towerMat, built.length * 2, { aColor: 3, aTrim: 3, aData: 4, aBorn: 1 }, (i, m, set) => {
      const t = built[i % built.length];
      const team = claimed.get(t.id)!;
      set("aColor", ...rgb("#2a3342"));
      set("aTrim", ...rgb(t.color));
      set("aBorn", -1e4);
      if (i < built.length) {
        place(m, t.x, 0, t.z, t.w, t.h, t.d);
        set("aData", 0, t.num * 7.3, launch ? t.floors : team.seats, 0.7);
      } else {
        place(m, t.x, t.h, t.z, t.w * 0.62, crownH(t), t.d * 0.62);
        set("aData", 0.5, t.num * 3.1, -1, 0.7);
      }
    });
    const antennas = buildInstanced(unitBox, litMat, built.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const t = built[i];
      place(m, t.x, t.h + crownH(t), t.z, 0.25, 8 + (t.num % 4) * 3, 0.25);
      set("aColor", 0.6, 0.62, 0.7);
      set("aGlow", 1);
    });
    const tips = buildInstanced(new THREE.SphereGeometry(0.45, 8, 6), blinkMat, built.length, {}, (i, m) => {
      const t = built[i];
      place(m, t.x, t.h + crownH(t) + 8 + (t.num % 4) * 3, t.z);
    });
    // Open tower sites: a bare foundation slab and corner posts.
    const slabs = buildInstanced(unitBox, litMat, open.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const t = open[i];
      place(m, t.x, 0, t.z, t.w, 0.35, t.d);
      set("aColor", ...rgb("#39404d"));
      set("aGlow", 0.6);
    });
    const posts = buildInstanced(unitBox, glowMat, open.length * 4, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const t = open[Math.floor(i / 4)];
      const k = i % 4;
      place(m, t.x + ((k & 1 ? 1 : -1) * t.w) / 2, 0, t.z + ((k & 2 ? 1 : -1) * t.d) / 2, 0.22, 3, 0.22);
      set("aColor", ...rgb("#ffc15e"));
      set("aGlow", 1.6);
    });
    return [bodies, antennas, tips, slabs, posts];
  }, [teams, launch]);

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);

  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <OpenSites />
      <Suspense fallback={null}>
        <TowerLabels />
      </Suspense>
      <Registry />
    </group>
  );
}

/** Holographic outline of the tower that could stand on each open site. */
function OpenSites() {
  const teams = useCity((s) => s.teams);
  const open = useMemo(() => CITY.towers.filter((t) => !teams.some((x) => x.towerId === t.id)), [teams]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: shared.uTime },
        vertexShader: `varying vec2 vUv; varying float vY; void main(){ vUv = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; varying vec2 vUv; varying float vY;
          void main(){
            vec2 e = min(vUv, 1.0 - vUv);
            float edge = smoothstep(0.012, 0.0, min(e.x, e.y));
            float floors = smoothstep(0.02, 0.0, abs(fract(vUv.y * 12.0) - 0.5) - 0.48);
            float scan = smoothstep(0.03, 0.0, abs(fract(vUv.y - uTime * 0.08) - 0.5));
            float fade = 1.0 - vUv.y * 0.7;
            gl_FragColor = vec4(vec3(1.0, 0.76, 0.37), (edge * 0.3 + floors * 0.025 + scan * 0.1) * fade);
          }
        `,
      }),
    [],
  );
  return (
    <>
      {open.map((t) => (
        <mesh key={t.id} position={[t.x, t.h / 2, t.z]} material={mat}>
          <boxGeometry args={[t.w, t.h, t.d]} />
        </mesh>
      ))}
    </>
  );
}

function TowerLabels() {
  const teams = useCity((s) => s.teams);
  const claimed = useMemo(() => new Map<string, Team>(teams.map((t) => [t.towerId, t])), [teams]);
  return (
    <>
      {CITY.towers.map((t) => {
        const team = claimed.get(t.id);
        return team ? (
          <Billboard key={t.id} position={[t.x, t.h + crownH(t) + 3, t.z]}>
            <Text font={FONT_DISPLAY} fontSize={2.6} anchorY="bottom" maxWidth={40} textAlign="center" outlineWidth={0.06} outlineColor="#050810">
              {team.name.toUpperCase()}
              <meshBasicMaterial toneMapped={false} color={new THREE.Color(t.color).multiplyScalar(1.8)} />
            </Text>
            <Text font={FONT_MONO} fontSize={1.1} anchorY="top" position={[0, -0.4, 0]} color="#dfe8f5">
              {`${t.id} · ${team.seats} SEATS`}
            </Text>
          </Billboard>
        ) : (
          <Billboard key={t.id} position={[t.x, 5, t.z]}>
            <Text font={FONT_DISPLAY} fontSize={1.3} anchorY="bottom" outlineWidth={0.04} outlineColor="#050810">
              {`TOWER SITE ${t.id}`}
              <meshBasicMaterial toneMapped={false} color={[2.4, 1.7, 0.7]} />
            </Text>
            <Text font={FONT_MONO} fontSize={0.6} anchorY="top" position={[0, -0.3, 0]} color="#f3e3c4" outlineWidth={0.02} outlineColor="#050810">
              {`AVAILABLE · ${t.floors} FLOORS`}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}

/** The Land Registry at the centre: the city's landmark, visible from anywhere. */
function Registry() {
  const rings = useRef<THREE.Group>(null);
  const logo = useRef<THREE.Group>(null);
  const beam = useMemo(() => makeHoloMaterial("#9fdcff", 0.22), []);
  const launch = useCity((s) => s.launch);

  const body = useMemo(() => {
    const tiers: [number, number][] = [[9, 26], [7, 30], [5.4, 30], [4, 24], [2.6, 20]];
    const base = tiers.map((_, i) => tiers.slice(0, i).reduce((a, t) => a + t[1], 0));
    return buildInstanced(unitBox, hqMat, tiers.length, { aColor: 3, aTrim: 3, aData: 4, aBorn: 1 }, (i, m, set) => {
      const [w, h] = tiers[i];
      place(m, 0, base[i], 0, w, h, w);
      set("aColor", ...rgb("#3a4353"));
      set("aTrim", ...rgb(i % 2 ? "#4fd1ff" : "#ffc15e"));
      set("aData", 0.65, 50 + i, -1, 0.9);
      set("aBorn", -1e4);
    });
  }, []);
  const top = 130;

  useFrame((_, dt) => {
    if (rings.current) rings.current.rotation.y += dt * 0.2;
    if (logo.current) logo.current.rotation.y -= dt * 0.1;
  });

  return (
    <group>
      <primitive object={body} />
      <mesh position={[0, top + 9, 0]}>
        <cylinderGeometry args={[0.12, 0.5, 18, 6]} />
        <meshBasicMaterial color={[2.5, 2.5, 2.8]} toneMapped={false} />
      </mesh>
      <mesh position={[0, top + 18 + 400, 0]}>
        <cylinderGeometry args={[launch ? 5 : 1.6, 1.8, 800, 16, 1, true]} />
        <primitive object={beam} attach="material" />
      </mesh>
      <group ref={rings}>
        {[56, 86, 116].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[10 - i * 2, 0.12, 6, 64]} />
            <meshBasicMaterial color={i % 2 ? [2.4, 1.8, 0.8] : [0.8, 2.2, 3]} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Suspense fallback={null}>
        <group ref={logo} position={[0, 70, 0]}>
          {[0, 1, 2, 3].map((k) => (
            <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
              <Text font={FONT_DISPLAY} fontSize={4.2} position={[0, 0, 13]} anchorX="center" anchorY="middle" letterSpacing={0.1}>
                MERGECITY
                {/* Front side only: double-sided, the neighbouring face's text showed through mirrored. */}
                <meshBasicMaterial toneMapped={false} color={[1.6, 2.2, 2.8]} side={THREE.FrontSide} />
              </Text>
            </group>
          ))}
        </group>
        <Billboard position={[0, 9, HQ.r + 5]}>
          <Text font={FONT_DISPLAY} fontSize={1.1} color="#ffffff" outlineWidth={0.04} outlineColor="#050810">
            LAND REGISTRY
          </Text>
          <Text font={FONT_MONO} fontSize={0.45} position={[0, -0.9, 0]} color="#c9d4e5">
            walk up and press E
          </Text>
        </Billboard>
      </Suspense>
    </group>
  );
}
