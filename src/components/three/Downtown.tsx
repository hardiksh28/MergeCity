"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { CITY, HQ, TOWER_FLOOR_H } from "@/lib/city";
import { useCity } from "@/lib/store";
import { buildInstanced, place, rgb, unitBox } from "./instancing";
import { makeBuildingMaterial, makeGlowMaterial, makeHoloMaterial, shared } from "./shaders";
import { FONT_DISPLAY, FONT_MONO } from "./fonts";

const towerMat = makeBuildingMaterial({ winW: 2.1, winH: TOWER_FLOOR_H, scan: 1, edge: 1.2 });
const glowMat = makeGlowMaterial();

const blinkMat = new THREE.ShaderMaterial({
  uniforms: { uTime: shared.uTime },
  vertexShader: /* glsl */ `
    uniform float uTime; varying float vOn;
    void main(){
      float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
      vOn = 0.15 + 0.85 * step(0.55, fract(uTime * 0.8 + ph));
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `varying float vOn; void main(){ gl_FragColor = vec4(vec3(4.0, 0.25, 0.3) * vOn, 1.0); }`,
});

const ADS = [
  { text: "SHIP IT.", color: "#ff2bd6" },
  { text: "git merge --no-ff", color: "#22f3ff" },
  { text: "0 CONFLICTS", color: "#b6ff3b" },
  { text: "REVIEW < 5 MIN", color: "#ffb020" },
  { text: "LGTM", color: "#ff2bd6" },
  { text: "MERGEMATE", color: "#22f3ff" },
];

export function Downtown() {
  const teams = useCity((s) => s.teams);
  const launch = useCity((s) => s.launch);

  const meshes = useMemo(() => {
    const claimed = new Map(teams.map((t) => [t.towerId, t]));
    const T = CITY.towers;
    const bodies = buildInstanced(unitBox, towerMat, T.length * 2, { aColor: 3, aData: 4 }, (i, m, set) => {
      const t = T[i % T.length];
      const team = claimed.get(t.id);
      set("aColor", ...rgb(team ? t.color : "#ff6a3d"));
      if (i < T.length) {
        place(m, t.x, 0, t.z, t.w, t.h, t.d);
        set("aData", team ? 0 : 0.1, t.num * 7.3, team ? (launch ? t.floors : team.seats) : launch ? t.floors : -1, team ? 1 : 0.35);
      } else {
        // setback crown on top
        const ch = 6 + (t.num % 3) * 4;
        place(m, t.x, t.h, t.z, t.w * 0.62, ch, t.d * 0.62);
        set("aData", team ? 0.6 : 0.05, t.num * 3.1, -1, team ? 1 : 0.3);
      }
    });
    const antennas = buildInstanced(unitBox, glowMat, T.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const t = T[i];
      const ch = 6 + (t.num % 3) * 4;
      place(m, t.x, t.h + ch, t.z, 0.25, 10 + (t.num % 4) * 5, 0.25);
      set("aColor", 0.7, 0.7, 0.9);
      set("aGlow", 0.5);
    });
    const tips = buildInstanced(new THREE.SphereGeometry(0.5, 8, 6), blinkMat, T.length, {}, (i, m) => {
      const t = T[i];
      const ch = 6 + (t.num % 3) * 4;
      place(m, t.x, t.h + ch + 10 + (t.num % 4) * 5, t.z);
    });
    return [bodies, antennas, tips];
  }, [teams, launch]);

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);

  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <Suspense fallback={null}>
        <TowerLabels />
        <Billboards />
      </Suspense>
      <Spire />
      <Searchlights />
    </group>
  );
}

function TowerLabels() {
  const teams = useCity((s) => s.teams);
  const claimed = useMemo(() => new Map(teams.map((t) => [t.towerId, t])), [teams]);
  return (
    <>
      {CITY.towers.map((t) => {
        const team = claimed.get(t.id);
        const ch = 6 + (t.num % 3) * 4;
        return (
          <Billboard key={t.id} position={[t.x, t.h + ch + 3, t.z]}>
            {team ? (
              <>
                <Text font={FONT_DISPLAY} fontSize={3.2} anchorY="bottom" maxWidth={40} textAlign="center">
                  {team.name.toUpperCase()}
                  <meshBasicMaterial toneMapped={false} color={new THREE.Color(t.color).multiplyScalar(3)} />
                </Text>
                <Text font={FONT_MONO} fontSize={1.3} anchorY="top" position={[0, -0.4, 0]} color="#ffffff">
                  {`${t.id} · ${team.seats} SEATS LIT`}
                </Text>
              </>
            ) : (
              <>
                <Text font={FONT_DISPLAY} fontSize={2.2} anchorY="bottom">
                  {`${t.id} · UNCLAIMED`}
                  <meshBasicMaterial toneMapped={false} color={[3.5, 0.9, 0.3]} />
                </Text>
                <Text font={FONT_MONO} fontSize={1.1} anchorY="top" position={[0, -0.4, 0]} color="#ffd2a8">
                  YOUR TEAM&apos;S NAME HERE
                </Text>
              </>
            )}
          </Billboard>
        );
      })}
    </>
  );
}

function Billboards() {
  const items = useMemo(
    () =>
      CITY.towers.slice(0, ADS.length * 2).filter((_, i) => i % 2 === 0).map((t, i) => {
        // Put the ad on the face pointing away from the centre.
        const ax = Math.abs(t.x) > Math.abs(t.z);
        const sx = Math.sign(t.x) || 1;
        const sz = Math.sign(t.z) || 1;
        const pos: [number, number, number] = ax ? [t.x + sx * (t.w / 2 + 0.3), t.h * 0.62, t.z] : [t.x, t.h * 0.62, t.z + sz * (t.d / 2 + 0.3)];
        const rot = ax ? (sx > 0 ? Math.PI / 2 : -Math.PI / 2) : sz > 0 ? 0 : Math.PI;
        const w = (ax ? t.d : t.w) * 0.85;
        return { ...ADS[i], pos, rot, w };
      }),
    [],
  );
  return (
    <>
      {items.map((b, i) => (
        <group key={i} position={b.pos} rotation={[0, b.rot, 0]}>
          <mesh>
            <planeGeometry args={[b.w, b.w * 0.55]} />
            <AdPanelMaterial color={b.color} />
          </mesh>
          <Text font={FONT_DISPLAY} fontSize={b.w * 0.11} maxWidth={b.w * 0.9} textAlign="center" position={[0, 0, 0.05]}>
            {b.text}
            <meshBasicMaterial toneMapped={false} color={new THREE.Color(b.color).multiplyScalar(4)} />
          </Text>
        </group>
      ))}
    </>
  );
}

function AdPanelMaterial({ color }: { color: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { uTime: shared.uTime, uColor: { value: new THREE.Color(color) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
          float h(float n){ return fract(sin(n) * 43758.5453); }
          void main(){
            float scan = 0.75 + 0.25 * sin(vUv.y * 180.0 + uTime * 8.0);
            float glitch = step(0.96, h(floor(vUv.y * 24.0) + floor(uTime * 6.0)));
            vec2 e = min(vUv, 1.0 - vUv);
            float frame = smoothstep(0.025, 0.0, min(e.x, e.y));
            vec3 bg = mix(vec3(0.02, 0.0, 0.05), uColor * 0.25, vUv.y) * scan;
            vec3 col = bg + uColor * frame * 3.0 + uColor * glitch * 0.8;
            gl_FragColor = vec4(col, 0.92);
          }
        `,
      }),
    [color],
  );
  return <primitive object={mat} attach="material" />;
}

function Spire() {
  const rings = useRef<THREE.Group>(null);
  const logo = useRef<THREE.Group>(null);
  const beamMat = useMemo(() => makeHoloMaterial("#ff2bd6", 0.45), []);
  const beam2 = useMemo(() => makeHoloMaterial("#22f3ff", 0.35), []);
  const launch = useCity((s) => s.launch);

  const body = useMemo(() => {
    const tiers = [
      [9, 60], [7, 50], [5.5, 45], [4, 35], [2.6, 20],
    ];
    const base = tiers.map((_, i) => tiers.slice(0, i).reduce((a, t) => a + t[1], 0));
    return buildInstanced(unitBox, towerMat, tiers.length, { aColor: 3, aData: 4 }, (i, m, set) => {
      const [w, h] = tiers[i];
      place(m, 0, base[i], 0, w, h, w);
      set("aColor", ...rgb(i % 2 ? "#22f3ff" : "#ff2bd6"));
      set("aData", 0.7, 50 + i, -1, 1);
    });
  }, []);

  useFrame((_, dt) => {
    if (rings.current) rings.current.rotation.y += dt * 0.25;
    if (logo.current) logo.current.rotation.y -= dt * 0.12;
  });

  return (
    <group>
      <primitive object={body} />
      <mesh position={[0, 215, 0]}>
        <cylinderGeometry args={[0.15, 0.6, 30, 6]} />
        <meshBasicMaterial color={[4, 3, 4]} toneMapped={false} />
      </mesh>
      {/* sky beam */}
      <mesh position={[0, 210 + 400, 0]}>
        <cylinderGeometry args={[launch ? 6 : 2.5, 3, 800, 16, 1, true]} />
        <primitive object={beamMat} attach="material" />
      </mesh>
      <mesh position={[0, 30, 0]}>
        <cylinderGeometry args={[11, 11, 60, 32, 1, true]} />
        <primitive object={beam2} attach="material" />
      </mesh>
      <group ref={rings}>
        {[70, 110, 150, 185].map((y, i) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2 + (i % 2 ? 0.12 : -0.12), 0, 0]}>
            <torusGeometry args={[14 - i * 2.2, 0.18, 6, 64]} />
            <meshBasicMaterial color={i % 2 ? [0.4, 3.5, 4] : [4, 0.5, 3.4]} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Suspense fallback={null}>
        <group ref={logo} position={[0, 128, 0]}>
          {[0, 1, 2, 3].map((k) => (
            <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
              <Text font={FONT_DISPLAY} fontSize={9} position={[0, 0, 24]} anchorX="center" anchorY="middle" letterSpacing={0.08}>
                MERGECITY
                <meshBasicMaterial toneMapped={false} color={k % 2 ? [0.5, 3.6, 4.2] : [4.2, 0.6, 3.6]} side={THREE.DoubleSide} />
              </Text>
            </group>
          ))}
        </group>
        <Billboard position={[0, 12, HQ.r + 6]}>
          <Text font={FONT_DISPLAY} fontSize={1.4} color="#fff">
            MERGEMATE HQ
          </Text>
        </Billboard>
      </Suspense>
    </group>
  );
}

function Searchlights() {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(() => ["#22f3ff", "#ff2bd6", "#b6ff3b", "#ffb020"].map((c) => makeHoloMaterial(c, 0.12)), []);
  const spots = useMemo(() => CITY.towers.filter((_, i) => i % 5 === 0).slice(0, 4), []);
  const pivots = useRef<THREE.Group[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    pivots.current.forEach((c, i) => {
      if (!c) return;
      c.rotation.z = Math.sin(t * 0.3 + i * 1.7) * 0.5;
      c.rotation.x = Math.cos(t * 0.23 + i * 2.1) * 0.5;
    });
  });
  return (
    <group ref={group}>
      {spots.map((t, i) => (
        <group
          key={t.id}
          position={[t.x, t.h + 8, t.z]}
          ref={(g) => {
            if (g) pivots.current[i] = g;
          }}
        >
          <mesh position={[0, 160, 0]}>
            <cylinderGeometry args={[18, 0.6, 320, 20, 1, true]} />
            <primitive object={mats[i]} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
