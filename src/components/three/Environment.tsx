"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { BLOCK, CITY, CITY_R, DISTRICT_META, DOWNTOWN_R, MAINSTREET_R, PLOTS_BY_ID, ROAD } from "@/lib/city";
import { mulberry32 } from "@/lib/rng";
import { useCity } from "@/lib/store";
import { buildInstanced, place, rgb, unitBox } from "./instancing";
import { makeBuildingMaterial, makeGlowMaterial, makeGroundMaterial, makeHoloMaterial, makeSkyMaterial, shared } from "./shaders";
import { FONT_DISPLAY, FONT_MONO } from "./fonts";

const glowMat = makeGlowMaterial();

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

export function Lamps() {
  const meshes = useMemo(() => {
    const L = CITY.lamps;
    const poles = buildInstanced(unitBox, glowMat, L.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      place(m, L[i][0], 0, L[i][1], 0.14, 5, 0.14);
      set("aColor", 0.25, 0.22, 0.4);
      set("aGlow", 0.5);
    });
    const heads = buildInstanced(unitBox, glowMat, L.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const [x, z] = L[i];
      place(m, x, 5, z, 0.9, 0.18, 0.9);
      const d = Math.hypot(x, z);
      set("aColor", ...rgb(d < DOWNTOWN_R ? "#22f3ff" : d < MAINSTREET_R ? "#ff2bd6" : "#b98cff"));
      set("aGlow", 3.2);
    });
    return [poles, heads];
  }, []);
  // Soft light pools on the ground under each lamp.
  const pools = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aColor; varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = aColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vC; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vC, pow(max(0.0, 1.0 - d), 2.0) * 0.45); }`,
    });
    const L = CITY.lamps;
    return buildInstanced(new THREE.PlaneGeometry(1, 1), mat, L.length, { aColor: 3 }, (i, m, set) => {
      const [x, z] = L[i];
      place(m, x, 0.03, z, 9, 9, 1, 0, -Math.PI / 2);
      const d = Math.hypot(x, z);
      set("aColor", ...rgb(d < DOWNTOWN_R ? "#22f3ff" : d < MAINSTREET_R ? "#ff2bd6" : "#b98cff"));
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
    const T = CITY.trees;
    const trunks = buildInstanced(unitBox, glowMat, T.length, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const [x, z, s] = T[i];
      place(m, x, 0, z, 0.3 * s, 1.6 * s, 0.3 * s);
      set("aColor", 0.15, 0.08, 0.2);
      set("aGlow", 1);
    });
    const leafGeo = new THREE.ConeGeometry(1, 1, 5, 1).translate(0, 0.5, 0);
    const leaves = buildInstanced(leafGeo, glowMat, T.length * 2, { aColor: 3, aGlow: 1 }, (i, m, set) => {
      const [x, z, s] = T[i % T.length];
      const top = i >= T.length;
      place(m, x, (top ? 3.2 : 1.4) * s, z, (top ? 1.2 : 1.9) * s, (top ? 2.2 : 2.6) * s, (top ? 1.2 : 1.9) * s, i * 0.7);
      set("aColor", ...rgb(top ? "#1bffc0" : "#0b5e5a"));
      set("aGlow", top ? 1.6 : 0.9);
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

/** A ring of megastructures beyond the city limit so the skyline never ends. */
export function Backdrop({ count }: { count: number }) {
  const mesh = useMemo(() => {
    const rand = mulberry32(77);
    const mat = makeBuildingMaterial({ winW: 3, winH: 4.5, scan: 0.6, edge: 0.8 });
    const cols = ["#22f3ff", "#ff2bd6", "#8b5cff", "#ffb020", "#b6ff3b"];
    return buildInstanced(unitBox, mat, count, { aColor: 3, aData: 4 }, (i, m, set) => {
      const a = rand() * Math.PI * 2;
      const r = 330 + rand() * 330;
      const behindSun = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI / 2) < 0.35;
      const h = (40 + Math.pow(rand(), 2) * 260) * (behindSun ? 0.22 : 1);
      const w = 16 + rand() * 30;
      place(m, Math.cos(a) * r, 0, Math.sin(a) * r, w, h, 16 + rand() * 30, 0);
      set("aColor", ...rgb(cols[Math.floor(rand() * cols.length)]));
      set("aData", 0.18 + rand() * 0.4, rand() * 100, -1, 0.6);
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
        return (
          <group key={i} position={[a.x, 0, a.z]} rotation={[0, a.rotY, 0]}>
            {[-1, 1].map((k) => (
              <mesh key={k} position={[(k * span) / 2, 5, 0]}>
                <boxGeometry args={[0.8, 10, 0.8]} />
                <meshBasicMaterial color={new THREE.Color(meta.color).multiplyScalar(0.25)} />
              </mesh>
            ))}
            <mesh position={[0, 10.4, 0]}>
              <boxGeometry args={[span + 1.4, 1.8, 0.5]} />
              <meshBasicMaterial color="#07030f" />
            </mesh>
            {[-1, 1].map((k) => (
              <mesh key={k} position={[0, k > 0 ? 11.35 : 9.45, 0]}>
                <boxGeometry args={[span + 1.4, 0.08, 0.55]} />
                <meshBasicMaterial color={new THREE.Color(meta.color).multiplyScalar(4)} toneMapped={false} />
              </mesh>
            ))}
            {[1, -1].map((side) => (
              <group key={side} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
                <Text font={FONT_DISPLAY} fontSize={0.95} position={[0, 10.55, 0.28]} anchorY="middle">
                  {meta.name.toUpperCase()}
                  <meshBasicMaterial toneMapped={false} color={new THREE.Color(meta.color).multiplyScalar(3.5)} />
                </Text>
                <Text font={FONT_MONO} fontSize={0.32} position={[0, 9.8, 0.28]} color="#e6dcff" anchorY="middle" maxWidth={span}>
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

/** Instanced hover-cars on looping lanes. Everything moves in the vertex shader. */
export function FlyingCars({ count }: { count: number }) {
  const mesh = useMemo(() => {
    const rand = mulberry32(5);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec4 aLane; // radius, height, speed, phase
        attribute vec3 aColor;
        varying vec3 vColor; varying float vTail;
        void main(){
          float ang = aLane.w + uTime * aLane.z / aLane.x;
          vec3 center = vec3(cos(ang) * aLane.x, aLane.y + sin(uTime * 0.7 + aLane.w * 3.0) * 1.5, sin(ang) * aLane.x);
          vec3 fwd = normalize(vec3(-sin(ang), 0.0, cos(ang))) * sign(aLane.z);
          vec3 side = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
          // stretch the box along the direction of travel into a light streak
          vec3 p = position;
          vTail = clamp(-p.z + 0.5, 0.0, 1.0);
          vec3 world = center + side * p.x * 1.4 + vec3(0.0, p.y * 0.7, 0.0) + fwd * p.z * 7.0;
          vColor = aColor;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vTail;
        void main(){ gl_FragColor = vec4(mix(vec3(3.0), vColor * 3.0, vTail) * (1.0 - vTail * 0.6), 1.0); }
      `,
    });
    const cols = ["#ff2bd6", "#22f3ff", "#ffb020", "#ffffff", "#b6ff3b"];
    const g = new THREE.BoxGeometry(1, 1, 1);
    return buildInstanced(g, mat, count, { aLane: 4, aColor: 3 }, (i, _m, set) => {
      const lane = Math.floor(rand() * 7);
      const r = 40 + lane * 38 + rand() * 6;
      const hgt = 26 + lane * 9 + rand() * 30;
      const dir = rand() < 0.5 ? -1 : 1;
      set("aLane", r, hgt, dir * (18 + rand() * 30), rand() * Math.PI * 2);
      set("aColor", ...rgb(cols[Math.floor(rand() * cols.length)]));
    });
  }, [count]);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return <primitive object={mesh} />;
}

/** Neon rain in a box that follows the camera. Zero CPU cost per frame. */
export function Rain({ count }: { count: number }) {
  const { camera } = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: shared.uTime, uCam: { value: new THREE.Vector3() } },
        vertexShader: /* glsl */ `
          uniform float uTime; uniform vec3 uCam;
          attribute vec3 aSeed;
          varying float vA;
          void main(){
            float S = 70.0;
            vec3 base = aSeed * S;
            base.y = mod(aSeed.y * 60.0 - uTime * (38.0 + aSeed.x * 10.0), 60.0);
            vec3 wrapped = vec3(mod(base.x - uCam.x + S * 0.5, S) - S * 0.5, base.y, mod(base.z - uCam.z + S * 0.5, S) - S * 0.5);
            vec3 world = vec3(uCam.x, max(uCam.y - 25.0, 0.0), uCam.z) + wrapped + vec3(0.0, position.y * 1.4, 0.0);
            vec4 mv = viewMatrix * vec4(world, 1.0);
            mv.x += position.x * 0.05;
            vA = 0.08 + aSeed.z * 0.14;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(vec3(0.5, 0.75, 1.6), vA); }`,
      }),
    [],
  );
  const mesh = useMemo(() => {
    const rand = mulberry32(3);
    return buildInstanced(new THREE.PlaneGeometry(1, 1), mat, count, { aSeed: 3 }, (_i, _m, set) => {
      set("aSeed", rand(), rand(), rand());
    });
  }, [count, mat]);
  useFrame(() => mat.uniforms.uCam.value.copy(camera.position));
  return <primitive object={mesh} />;
}

/** Light pillars where someone just moved in. */
export function ArrivalBeams() {
  const arrivals = useCity((s) => s.arrivals);
  const mat = useMemo(() => makeHoloMaterial("#b6ff3b", 0.9), []);
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
          attribute vec4 aBurst; // x, y, z, phase
          attribute vec3 aDir; attribute vec3 aColor;
          varying vec3 vColor; varying float vA;
          void main(){
            float period = 3.2;
            float t = mod(uTime + aBurst.w, period) / period;
            vec3 p = aBurst.xyz + aDir * 38.0 * (1.0 - pow(1.0 - t, 3.0)) + vec3(0.0, -18.0 * t * t, 0.0);
            vec4 mv = viewMatrix * vec4(p, 1.0);
            gl_PointSize = (1.0 - t) * 900.0 / -mv.z;
            gl_Position = projectionMatrix * mv;
            vColor = aColor; vA = 1.0 - t;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor; varying float vA;
          void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vColor * 3.0, smoothstep(0.5, 0.0, d) * vA); }
        `,
      }),
    [],
  );
  const geo = useMemo(() => {
    const rand = mulberry32(11);
    const burst = new Float32Array(COUNT * 4);
    const dir = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const cols = ["#ff2bd6", "#22f3ff", "#b6ff3b", "#ffb020", "#ffffff"];
    let b = [0, 0, 0, 0];
    let c = [1, 1, 1];
    for (let i = 0; i < COUNT; i++) {
      if (i % 60 === 0) {
        const a = rand() * Math.PI * 2;
        const r = 30 + rand() * 180;
        b = [Math.cos(a) * r, 90 + rand() * 90, Math.sin(a) * r, rand() * 3.2];
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
