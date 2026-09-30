"use client";

import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Billboard, Text } from "@react-three/drei";
import { CITY, FLOOR_H, HOUSE, PLOTS_BY_ID } from "@/lib/city";
import { GARDEN_COLORS, GARDEN_DAYS, GARDEN_WEEKS, gardenFor } from "@/lib/garden";
import { useCity } from "@/lib/store";
import { hashString } from "@/lib/rng";
import { buildInstanced, place, rgb, unitBox } from "./instancing";
import { makeBuildingMaterial, makeGlowMaterial, makeHoloMaterial, makeRoofMaterial, shared } from "./shaders";
import { FONT_DISPLAY } from "./fonts";

const bodyMat = makeBuildingMaterial({ winW: 1.25, winH: FLOOR_H });
const roofMat = makeRoofMaterial();
const glowMat = makeGlowMaterial();
const litMat = makeGlowMaterial({ lit: true });
const flagMat = makeGlowMaterial({ wave: true });
const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true).rotateY(Math.PI / 4).translate(0, 0.5, 0);
const doorGeo = new THREE.PlaneGeometry(1.05, 1.9);
const flagGeo = new THREE.PlaneGeometry(1.5, 1, 8, 1).translate(0.75, 0, 0);
const beaconMat = makeHoloMaterial("#7ee787", 0.55);

const WALLS = ["#5b6474", "#6d6255", "#56685b", "#6a5a5a", "#4f5f73", "#7a6f60", "#5f5b6e", "#66706b"];
const ROOFS = ["#2a2f3a", "#3a2d28", "#28332c", "#332a33", "#2b3444"];

// Empty land: a softly marked parcel waiting to be registered.
const parcelMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { uTime: shared.uTime },
  vertexShader: /* glsl */ `
    attribute vec3 aColor; varying vec2 vUv; varying vec3 vColor;
    void main(){ vUv = uv; vColor = aColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime; varying vec2 vUv; varying vec3 vColor;
    void main(){
      vec2 e = min(vUv, 1.0 - vUv);
      float edge = smoothstep(0.035, 0.0, min(e.x, e.y));
      float dash = step(0.45, fract((vUv.x + vUv.y) * 5.0));
      gl_FragColor = vec4(vColor, edge * (0.25 + 0.35 * dash) + 0.025);
    }
  `,
});

function pickFrom<T>(list: T[], id: string, salt: string) {
  return list[hashString(id + salt) % list.length];
}

export function Houses() {
  const residents = useCity((s) => s.residents);
  const meId = useCity((s) => s.me?.id);
  const launch = useCity((s) => s.launch);
  const arrivals = useCity((s) => s.arrivals);

  const meshes = useMemo(() => {
    const list = residents.map((r) => ({ r, p: PLOTS_BY_ID.get(r.plotId)! })).filter((x) => x.p);
    const born = new Map(arrivals.map((a) => [a.plotId, a.at / 1000]));
    const bornAt = (plotId: string) => born.get(plotId) ?? -1e4;
    const lit = (tier: string) => tier !== "free" || launch;

    const bodies = buildInstanced(unitBox, bodyMat, list.length, { aColor: 3, aTrim: 3, aData: 4, aBorn: 1 }, (i, m, set) => {
      const { r, p } = list[i];
      place(m, p.x, 0, p.z, HOUSE, r.floors * FLOOR_H + 0.3, HOUSE);
      set("aColor", ...rgb(pickFrom(WALLS, r.id, "w")));
      set("aTrim", ...rgb(r.look.outfit));
      const isMe = r.id === meId;
      set("aData", lit(r.tier) ? 0.8 : isMe ? 0.35 : 0.1, hashString(r.id) % 97, -1, lit(r.tier) ? 0.55 : isMe ? 0.4 : 0.08);
      set("aBorn", bornAt(r.plotId));
    });

    const roofs = buildInstanced(roofGeo, roofMat, list.length, { aColor: 3, aTrim: 3, aGlow: 1, aBorn: 1 }, (i, m, set) => {
      const { r, p } = list[i];
      place(m, p.x, r.floors * FLOOR_H + 0.3, p.z, HOUSE * 1.22, 1.6, HOUSE * 1.22);
      set("aColor", ...rgb(pickFrom(ROOFS, r.id, "r")));
      set("aTrim", ...rgb(r.look.outfit));
      set("aGlow", lit(r.tier) ? 0.5 : r.id === meId ? 0.35 : 0.05);
      set("aBorn", bornAt(r.plotId));
    });

    const doors = buildInstanced(doorGeo, glowMat, list.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const { r, p } = list[i];
      place(m, p.x + p.face * (HOUSE / 2 + 0.03), 0.95, p.z, 1, 1, 1, (p.face * Math.PI) / 2);
      const isMe = r.id === meId;
      set("aColor", ...rgb(launch ? "#fff4d6" : isMe ? "#7ee787" : lit(r.tier) ? "#ffcf8a" : r.look.outfit));
      set("aGlow", launch ? 3 : isMe ? 1.8 : lit(r.tier) ? 1.4 : 0.22);
    });

    // porch lamps above the door on lit houses
    const porch = list.filter((x) => lit(x.r.tier) || x.r.id === meId);
    const lamps = buildInstanced(unitBox, glowMat, porch.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const { p } = porch[i];
      place(m, p.x + p.face * (HOUSE / 2 + 0.12), 2.05, p.z, 0.18, 0.14, 0.4);
      set("aColor", ...rgb("#ffd49a"));
      set("aGlow", 4);
    });

    const founders = list.filter((x) => x.r.tier !== "free");
    const poles = buildInstanced(unitBox, litMat, founders.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const { p } = founders[i];
      place(m, p.x + p.face * (HOUSE / 2 + 1.3), 0, p.z - p.gardenSide * 1.7, 0.07, 4.4, 0.07);
      set("aColor", 0.75, 0.78, 0.85);
      set("aGlow", 0.8);
    });
    const flags = buildInstanced(flagGeo, flagMat, founders.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const { r, p } = founders[i];
      place(m, p.x + p.face * (HOUSE / 2 + 1.3), 3.95, p.z - p.gardenSide * 1.7, 1, 0.85, 1, p.face > 0 ? Math.PI / 2 : -Math.PI / 2);
      set("aColor", ...rgb(r.tier === "team" ? "#4fd1ff" : "#ffc15e"));
      set("aGlow", 1.3);
    });

    const gardeners = list.filter((x) => x.r.github);
    const cells = GARDEN_WEEKS * GARDEN_DAYS;
    const levels = gardeners.map((x) => gardenFor(x.r.github!));
    const garden = buildInstanced(unitBox, litMat, gardeners.length * cells, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const g = Math.floor(i / cells);
      const c = i % cells;
      const { p } = gardeners[g];
      const week = Math.floor(c / GARDEN_DAYS);
      const day = c % GARDEN_DAYS;
      const lvl = levels[g][c];
      const sp = 0.34;
      place(m, p.x + (week - (GARDEN_WEEKS - 1) / 2) * sp, 0, p.z + p.gardenSide * (HOUSE / 2 + 0.5 + day * sp), 0.27, 0.04 + lvl * 0.09, 0.27);
      set("aColor", ...rgb(GARDEN_COLORS[lvl]));
      set("aGlow", lvl === 0 ? 0.8 : 1 + lvl * 0.2);
    });

    const taken = new Set(residents.map((r) => r.plotId));
    const vacant = CITY.plots.filter((p) => !taken.has(p.id));
    const parcels = buildInstanced(new THREE.PlaneGeometry(1, 1), parcelMat, vacant.length, { aColor: 3 }, (i, m, set) => {
      const p = vacant[i];
      place(m, p.x, 0.03, p.z, HOUSE + 2, HOUSE + 2, 1, 0, -Math.PI / 2);
      set("aColor", ...rgb(p.district === "mainstreet" ? "#9fdcff" : "#bff5c4"));
    });
    const stakes = buildInstanced(unitBox, glowMat, vacant.length * 4, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const p = vacant[Math.floor(i / 4)];
      const k = i % 4;
      const o = (HOUSE + 2) / 2;
      place(m, p.x + (k & 1 ? o : -o), 0, p.z + (k & 2 ? o : -o), 0.1, 0.45, 0.1);
      set("aColor", ...rgb(p.district === "mainstreet" ? "#4fd1ff" : "#7ee787"));
      set("aGlow", 1.1);
    });

    return [bodies, roofs, doors, lamps, poles, flags, garden, parcels, stakes];
  }, [residents, meId, launch, arrivals]);

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);

  const myPlotId = useCity((s) => s.me?.plotId);
  const myPlot = myPlotId ? PLOTS_BY_ID.get(myPlotId) : null;

  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {myPlot && (
        // Home beacon: a soft pillar of light so you can always find your way back.
        <mesh position={[myPlot.x, 60, myPlot.z]}>
          <cylinderGeometry args={[0.9, 1.4, 120, 16, 1, true]} />
          <primitive object={beaconMat} attach="material" />
        </mesh>
      )}
      <Suspense fallback={null}>
        <NextPlotSigns />
      </Suspense>
    </group>
  );
}

/** Floating markers over the next free plot of each district. */
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
      {next.map((p) => {
        const ms = p.district === "mainstreet";
        return (
          <Billboard key={p.id} position={[p.x, 4.2, p.z]}>
            <Text font={FONT_DISPLAY} fontSize={0.7} anchorY="bottom" outlineWidth={0.03} outlineColor="#050810">
              {`PLOT ${p.num} · OPEN`}
              <meshBasicMaterial toneMapped={false} color={ms ? [0.8, 2.2, 3] : [1.1, 2.6, 1.2]} />
            </Text>
            <Text font={FONT_DISPLAY} fontSize={0.34} color="#dfe8f5" anchorY="top" position={[0, -0.15, 0]} outlineWidth={0.02} outlineColor="#050810">
              {ms ? "FOR FOUNDING RESIDENTS" : "NEXT TO BE REGISTERED"}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}
