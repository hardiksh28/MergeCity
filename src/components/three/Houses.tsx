"use client";

import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Billboard, Text } from "@react-three/drei";
import { CITY, FLOOR_H, HOUSE, PLOTS_BY_ID } from "@/lib/city";
import { GARDEN_COLORS, GARDEN_DAYS, GARDEN_WEEKS, gardenFor } from "@/lib/garden";
import { useCity } from "@/lib/store";
import { hashString } from "@/lib/rng";
import { buildInstanced, place, rgb, unitBox } from "./instancing";
import { makeBuildingMaterial, makeGlowMaterial, makeRoofMaterial, shared } from "./shaders";
import { FONT_DISPLAY } from "./fonts";

const bodyMat = makeBuildingMaterial({ winW: 1.25, winH: FLOOR_H, edge: 1 });
const roofMat = makeRoofMaterial();
const glowMat = makeGlowMaterial();
const flagMat = makeGlowMaterial({ wave: true });
const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const doorGeo = new THREE.PlaneGeometry(1.1, 1.9);
const flagGeo = new THREE.PlaneGeometry(1.7, 1, 8, 1).translate(0.85, 0, 0);

const vacantMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uTime: shared.uTime },
  vertexShader: /* glsl */ `
    attribute vec3 aColor; varying vec2 vUv; varying vec3 vColor;
    void main(){ vUv = uv; vColor = aColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vUv; varying vec3 vColor;
    void main(){
      vec2 e = min(vUv, 1.0 - vUv);
      float edge = smoothstep(0.05, 0.0, min(e.x, e.y));
      float along = vUv.x + vUv.y;
      float dash = step(0.5, fract(along * 6.0 - uTime * 0.8));
      float fill = 0.06 + 0.04 * sin(uTime * 2.0 + along * 3.0);
      gl_FragColor = vec4(vColor, edge * (0.35 + 0.65 * dash) + fill);
    }
  `,
});

export function Houses() {
  const residents = useCity((s) => s.residents);
  const meId = useCity((s) => s.me?.id);
  const launch = useCity((s) => s.launch);

  const meshes = useMemo(() => {
    const list = residents
      .map((r) => ({ r, p: PLOTS_BY_ID.get(r.plotId)! }))
      .filter((x) => x.p);
    const lit = (tier: string) => tier !== "free" || launch;

    const bodies = buildInstanced(unitBox, bodyMat, list.length, { aColor: 3, aData: 4 }, (i, m, set) => {
      const { r, p } = list[i];
      const h = r.floors * FLOOR_H + 0.3;
      place(m, p.x, 0, p.z, HOUSE, h, HOUSE);
      set("aColor", ...rgb(r.look.outfit));
      const isMe = r.id === meId;
      set("aData", lit(r.tier) ? 0.85 : isMe ? 0.2 : 0.04, hashString(r.id) % 97, -1, lit(r.tier) ? 1 : isMe ? 0.7 : 0.18);
    });

    const roofs = buildInstanced(roofGeo, roofMat, list.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const { r, p } = list[i];
      place(m, p.x, r.floors * FLOOR_H + 0.3, p.z, HOUSE * 1.18, 1.7, HOUSE * 1.18);
      set("aColor", ...rgb(r.look.outfit));
      set("aGlow", lit(r.tier) ? 1 : r.id === meId ? 0.6 : 0.1);
    });

    const doors = buildInstanced(doorGeo, glowMat, list.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const { r, p } = list[i];
      place(m, p.x + p.face * (HOUSE / 2 + 0.03), 0.95, p.z, 1, 1, 1, (p.face * Math.PI) / 2);
      const isMe = r.id === meId;
      set("aColor", ...rgb(launch ? "#ffffff" : isMe ? "#b6ff3b" : r.look.outfit));
      set("aGlow", launch ? 3.5 : isMe ? 2.6 : lit(r.tier) ? 1.8 : 0.35);
    });

    const founders = list.filter((x) => x.r.tier !== "free");
    const poles = buildInstanced(unitBox, glowMat, founders.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const { p } = founders[i];
      place(m, p.x + p.face * (HOUSE / 2 + 1.3), 0, p.z - p.gardenSide * 1.7, 0.08, 4.6, 0.08);
      set("aColor", 0.9, 0.9, 1);
      set("aGlow", 0.6);
    });
    const flags = buildInstanced(flagGeo, flagMat, founders.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const { r, p } = founders[i];
      place(m, p.x + p.face * (HOUSE / 2 + 1.3), 4.1, p.z - p.gardenSide * 1.7, 1, 0.9, 1, p.face > 0 ? Math.PI / 2 : -Math.PI / 2);
      set("aColor", ...rgb(r.tier === "team" ? "#22f3ff" : "#ffb020"));
      set("aGlow", 2.2);
    });

    const gardeners = list.filter((x) => x.r.github);
    const cells = GARDEN_WEEKS * GARDEN_DAYS;
    const gardenLevels = gardeners.map((x) => gardenFor(x.r.github!));
    const garden = buildInstanced(unitBox, glowMat, gardeners.length * cells, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const g = Math.floor(i / cells);
      const c = i % cells;
      const { p } = gardeners[g];
      const week = Math.floor(c / GARDEN_DAYS);
      const day = c % GARDEN_DAYS;
      const lvl = gardenLevels[g][c];
      const sp = 0.34;
      const x = p.x + (week - (GARDEN_WEEKS - 1) / 2) * sp;
      const z = p.z + p.gardenSide * (HOUSE / 2 + 0.5 + day * sp);
      place(m, x, 0, z, 0.27, 0.04 + lvl * 0.09, 0.27);
      set("aColor", ...rgb(GARDEN_COLORS[lvl]));
      set("aGlow", lvl === 0 ? 0.6 : 1 + lvl * 0.45);
    });

    const taken = new Set(residents.map((r) => r.plotId));
    const vacant = CITY.plots.filter((p) => !taken.has(p.id));
    const outlines = buildInstanced(new THREE.PlaneGeometry(1, 1), vacantMat, vacant.length, { aColor: 3 }, (i, m, set) => {
      const p = vacant[i];
      place(m, p.x, 0.04, p.z, HOUSE, HOUSE, 1, 0, -Math.PI / 2);
      set("aColor", ...rgb(p.district === "mainstreet" ? "#ff2bd6" : "#8b5cff"));
    });

    return [bodies, roofs, doors, poles, flags, garden, outlines];
  }, [residents, meId, launch]);

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);

  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <Suspense fallback={null}>
        <NextPlotSigns />
      </Suspense>
    </group>
  );
}

/** Floating "this could be yours" markers over the next free plot of each district. */
function NextPlotSigns() {
  const residents = useCity((s) => s.residents);
  const next = useMemo(() => {
    const taken = new Set(residents.map((r) => r.plotId));
    return (["outskirts", "mainstreet"] as const)
      .map((d) => CITY.plots.find((p) => p.district === d && !taken.has(p.id)))
      .filter(Boolean) as typeof CITY.plots;
  }, [residents]);

  return (
    <>
      {next.map((p) => (
        <Billboard key={p.id} position={[p.x, 5.5, p.z]}>
          <Text font={FONT_DISPLAY} fontSize={0.9} color={p.district === "mainstreet" ? "#ff2bd6" : "#b6ff3b"} anchorY="bottom" outlineWidth={0.02} outlineColor="#000">
            {`NEXT: PLOT ${p.num}`}
            <meshBasicMaterial toneMapped={false} color={p.district === "mainstreet" ? [4, 0.6, 3.4] : [2.4, 4, 0.8]} />
          </Text>
          <Text font={FONT_DISPLAY} fontSize={0.42} color="#ffffff" anchorY="top" position={[0, -0.2, 0]}>
            {p.district === "mainstreet" ? "FOUNDING RESIDENTS" : "NEXT PERSON TO JOIN"}
          </Text>
        </Billboard>
      ))}
    </>
  );
}
