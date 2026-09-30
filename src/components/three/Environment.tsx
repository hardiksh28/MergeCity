"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { BLOCK, CITY, CITY_R, DISTRICT_META, DOWNTOWN_R, MAINSTREET_R, PLOTS_BY_ID, ROAD } from "@/lib/city";
import { mulberry32 } from "@/lib/rng";
import { useCity } from "@/lib/store";
import { buildInstanced, place, rgb, unitBox } from "./instancing";
import { makeGlowMaterial, makeGroundMaterial, makeHoloMaterial, makeSkyMaterial, shared } from "./shaders";
import { FONT_DISPLAY, FONT_MONO } from "./fonts";

const glowMat = makeGlowMaterial();
const litMat = makeGlowMaterial({ lit: true });

export function Sky() {
  const mat = useMemo(() => makeSkyMaterial(), []);
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(() => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1500, 32, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

export function Ground() {
  const mat = useMemo(
    () => makeGroundMaterial({ block: BLOCK, road: ROAD, downtownR: DOWNTOWN_R, mainR: MAINSTREET_R, cityR: CITY_R }),
    [],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
      <circleGeometry args={[1400, 64]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

const LAMP = "#ffcf8a";

export function Lamps() {
  const meshes = useMemo(() => {
    const L = CITY.lamps;
    const poles = buildInstanced(unitBox, litMat, L.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      place(m, L[i][0], 0, L[i][1], 0.13, 5, 0.13);
      set("aColor", 0.32, 0.34, 0.4);
      set("aGlow", 1);
    });
    const arms = buildInstanced(unitBox, litMat, L.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      place(m, L[i][0], 4.9, L[i][1], 0.7, 0.1, 0.7);
      set("aColor", 0.25, 0.26, 0.3);
      set("aGlow", 1);
    });
    const heads = buildInstanced(unitBox, glowMat, L.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      place(m, L[i][0], 4.8, L[i][1], 0.5, 0.1, 0.5);
      set("aColor", ...rgb(LAMP));
      set("aGlow", 4.5);
    });
    return [poles, arms, heads];
  }, []);
  // Warm light pools on the ground under each lamp.
  const pools = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aColor; varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = aColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vC; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vC, pow(max(0.0, 1.0 - d), 2.2) * 0.5); }`,
    });
    const L = CITY.lamps;
    return buildInstanced(new THREE.PlaneGeometry(1, 1), mat, L.length, { aColor: 3 }, (i, m, set) => {
      place(m, L[i][0], 0.04, L[i][1], 11, 11, 1, 0, -Math.PI / 2);
      set("aColor", 0.55, 0.38, 0.2);
    });
  }, []);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <primitive object={pools} />
    </>
  );
}

export function Trees() {
  const meshes = useMemo(() => {
    const rand = mulberry32(41);
    // Extra trees scattered on the wild land around the city.
    const wild: [number, number, number][] = [];
    for (let i = 0; i < 260; i++) {
      const a = rand() * Math.PI * 2;
      const r = CITY_R + 25 + rand() * 180;
      wild.push([Math.cos(a) * r, Math.sin(a) * r, 0.9 + rand() * 1.1]);
    }
    const T = [...CITY.trees, ...wild];
    const trunks = buildInstanced(unitBox, litMat, T.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const [x, z, s] = T[i];
      place(m, x, 0, z, 0.3 * s, 1.7 * s, 0.3 * s);
      set("aColor", 0.2, 0.14, 0.1);
      set("aGlow", 1);
    });
    const leafGeo = new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0);
    const leaves = buildInstanced(leafGeo, litMat, T.length * 3, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const [x, z, s] = T[i % T.length];
      const tier = Math.floor(i / T.length);
      const y = [1.2, 2.4, 3.4][tier] * s;
      const w = [2.0, 1.55, 1.05][tier] * s;
      place(m, x, y, z, w, [2.2, 1.9, 1.6][tier] * s, w, i * 0.9);
      const c = [[0.07, 0.17, 0.1], [0.09, 0.21, 0.12], [0.11, 0.25, 0.14]][tier];
      set("aColor", c[0], c[1], c[2]);
      set("aGlow", 1);
    });
    return [trunks, leaves];
  }, []);
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

/** Low hills on the horizon instead of an endless skyline. */
export function Hills({ count }: { count: number }) {
  const mesh = useMemo(() => {
    const rand = mulberry32(77);
    const geo = new THREE.ConeGeometry(1, 1, 6, 1).translate(0, 0.5, 0);
    return buildInstanced(geo, litMat, count, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const a = (i / count) * Math.PI * 2 + rand() * 0.05;
      const r = 520 + rand() * 260;
      const h = 30 + rand() * 90;
      const w = 90 + rand() * 120;
      place(m, Math.cos(a) * r, -2, Math.sin(a) * r, w, h, w * (0.7 + rand() * 0.5), rand() * 6);
      const k = 0.5 + rand() * 0.3;
      set("aColor", 0.035 * k, 0.06 * k, 0.07 * k);
      set("aGlow", 1);
    });
  }, [count]);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

export function Arches() {
  return (
    <>
      {CITY.arches.map((a, i) => {
        const meta = DISTRICT_META[a.district];
        const span = ROAD + 1.2;
        const c = new THREE.Color(meta.color);
        return (
          <group key={i} position={[a.x, 0, a.z]} rotation={[0, a.rotY, 0]}>
            {[-1, 1].map((k) => (
              <mesh key={k} position={[(k * span) / 2, 4.5, 0]}>
                <boxGeometry args={[0.7, 9, 0.7]} />
                <meshStandardMaterial color="#2b3140" roughness={0.8} />
              </mesh>
            ))}
            <mesh position={[0, 9.3, 0]}>
              <boxGeometry args={[span + 1.4, 1.7, 0.45]} />
              <meshStandardMaterial color="#141925" roughness={0.6} />
            </mesh>
            <mesh position={[0, 8.42, 0]}>
              <boxGeometry args={[span + 1.4, 0.06, 0.5]} />
              <meshBasicMaterial color={c.clone().multiplyScalar(2.2)} toneMapped={false} />
            </mesh>
            {[1, -1].map((side) => (
              <group key={side} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
                <Text font={FONT_DISPLAY} fontSize={0.85} position={[0, 9.5, 0.26]} anchorY="middle">
                  {meta.name.toUpperCase()}
                  <meshBasicMaterial toneMapped={false} color={c.clone().multiplyScalar(1.8)} />
                </Text>
                <Text font={FONT_MONO} fontSize={0.28} position={[0, 8.85, 0.26]} color="#c9d4e5" anchorY="middle" maxWidth={span}>
                  {meta.blurb}
                </Text>
              </group>
            ))}
          </group>
        );
      })}
    </>
  );
}

/** A few distant aircraft lights drifting across the night sky. */
export function Aircraft({ count }: { count: number }) {
  const mesh = useMemo(() => {
    const rand = mulberry32(5);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec4 aLane; // radius, height, speed, phase
        varying float vBlink;
        void main(){
          float ang = aLane.w + uTime * aLane.z / aLane.x;
          vec3 c = vec3(cos(ang) * aLane.x, aLane.y, sin(ang) * aLane.x);
          vec4 mv = viewMatrix * vec4(c, 1.0);
          mv.xy += position.xy * 1.2;
          vBlink = step(0.85, fract(uTime * 0.9 + aLane.w));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `varying float vBlink; void main(){ gl_FragColor = vec4(mix(vec3(1.2, 1.2, 1.3), vec3(3.0, 0.4, 0.3), vBlink), 1.0); }`,
    });
    return buildInstanced(new THREE.PlaneGeometry(1, 1), mat, count, { aLane: 4 }, (_i, _m, set) => {
      set("aLane", 250 + rand() * 350, 140 + rand() * 120, (rand() < 0.5 ? -1 : 1) * (12 + rand() * 12), rand() * Math.PI * 2);
    });
  }, [count]);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

/** Fireflies drifting over the grass. GPU-only. */
export function Fireflies({ count }: { count: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: shared.uTime },
        vertexShader: /* glsl */ `
          uniform float uTime;
          attribute vec4 aSeed;
          varying float vA;
          void main(){
            vec3 p = vec3(aSeed.x, 0.6 + aSeed.w * 2.0, aSeed.y);
            p.x += sin(uTime * 0.4 + aSeed.z * 20.0) * 1.8;
            p.z += cos(uTime * 0.33 + aSeed.z * 13.0) * 1.8;
            p.y += sin(uTime * 0.9 + aSeed.z * 7.0) * 0.4;
            vec4 mv = viewMatrix * vec4(p, 1.0);
            vA = pow(0.5 + 0.5 * sin(uTime * 2.2 + aSeed.z * 40.0), 3.0);
            gl_PointSize = 90.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(2.2, 2.4, 0.9), smoothstep(0.5, 0.0, d) * vA); }`,
      }),
    [],
  );
  const geo = useMemo(() => {
    const rand = mulberry32(19);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = MAINSTREET_R + rand() * (CITY_R + 60 - MAINSTREET_R);
      seed.set([Math.cos(a) * r, Math.sin(a) * r, rand(), rand()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    return g;
  }, [count]);
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/** A pillar of light where someone just registered a plot. */
export function ArrivalBeams() {
  const arrivals = useCity((s) => s.arrivals);
  const mat = useMemo(() => makeHoloMaterial("#7ee787", 0.8), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const now = performance.now();
    arrivals.forEach((a, i) => {
      const m = refs.current[i];
      if (!m) return;
      const t = (now - a.at) / 3500;
      const s = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
      m.scale.set(s * 1.2 + 0.01, 1, s * 1.2 + 0.01);
      m.visible = t < 1;
    });
  });
  return (
    <>
      {arrivals.map((a, i) => {
        const p = PLOTS_BY_ID.get(a.plotId);
        if (!p) return null;
        return (
          <mesh key={a.plotId + a.at} position={[p.x, 150, p.z]} ref={(m) => void (refs.current[i] = m)}>
            <cylinderGeometry args={[3, 3, 300, 16, 1, true]} />
            <primitive object={mat} attach="material" />
          </mesh>
        );
      })}
    </>
  );
}

/** Launch-day fireworks: GPU particles in bursts over the city. */
export function Fireworks() {
  const COUNT = 60 * 14;
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: shared.uTime },
        vertexShader: /* glsl */ `
          uniform float uTime;
          attribute vec4 aBurst; attribute vec3 aDir; attribute vec3 aColor;
          varying vec3 vColor; varying float vA;
          void main(){
            float period = 3.2;
            float t = mod(uTime + aBurst.w, period) / period;
            vec3 p = aBurst.xyz + aDir * 34.0 * (1.0 - pow(1.0 - t, 3.0)) + vec3(0.0, -16.0 * t * t, 0.0);
            vec4 mv = viewMatrix * vec4(p, 1.0);
            gl_PointSize = (1.0 - t) * 800.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
            vColor = aColor; vA = 1.0 - t;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor; varying float vA;
          void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vColor * 2.5, smoothstep(0.5, 0.0, d) * vA); }
        `,
      }),
    [],
  );
  const geo = useMemo(() => {
    const rand = mulberry32(11);
    const burst = new Float32Array(COUNT * 4);
    const dir = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const cols = ["#ffc15e", "#4fd1ff", "#7ee787", "#ffffff", "#ff9f5a"];
    let b = [0, 0, 0, 0];
    let c = [1, 1, 1];
    for (let i = 0; i < COUNT; i++) {
      if (i % 60 === 0) {
        const a = rand() * Math.PI * 2;
        const r = 20 + rand() * 150;
        b = [Math.cos(a) * r, 80 + rand() * 80, Math.sin(a) * r, rand() * 3.2];
        c = rgb(cols[Math.floor(rand() * cols.length)]);
      }
      const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      burst.set(b, i * 4);
      dir.set([v.x, v.y, v.z], i * 3);
      col.set(c, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute("aBurst", new THREE.BufferAttribute(burst, 4));
    g.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    return g;
  }, [COUNT]);
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
