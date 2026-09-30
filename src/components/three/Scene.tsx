"use client";

import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { preloadFont } from "troika-three-text";
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useCity } from "@/lib/store";
import { rebuildColliders } from "@/lib/physics";
import { MOON_DIR, shared } from "./shaders";
import { Aircraft, Arches, ArrivalBeams, Fireflies, Fireworks, Ground, Hills, Lamps, Sky, Trees } from "./Environment";
import { Downtown } from "./Downtown";
import { Houses } from "./Houses";
import { Neighbours, Player } from "./Player";
import { CameraRig, PEDESTAL } from "./CameraRig";
import { FONT_BOLD, FONT_DISPLAY, FONT_MONO } from "./fonts";

function Clock() {
  useFrame((_, dt) => {
    // Page time in seconds, so "house born at" timestamps line up with shaders.
    shared.uTime.value = performance.now() / 1000;
    const target = useCity.getState().launch ? 1 : 0;
    shared.uLaunch.value += (target - shared.uLaunch.value) * Math.min(1, dt * 1.5);
  });
  return null;
}

function Colliders() {
  const residents = useCity((s) => s.residents);
  const teams = useCity((s) => s.teams);
  useEffect(() => rebuildColliders(residents, teams), [residents, teams]);
  return null;
}

/** Reports progress to the loading bar once shaders are compiled and frames flow. */
function ReadySignal() {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);
  useEffect(() => {
    useCity.getState().set({ progress: 0.75 });
    // Pre-compile every material so the first flyover frame doesn't hitch.
    try {
      gl.compile(scene, camera);
    } catch {}
  }, [gl, scene, camera]);
  useFrame(() => {
    frames.current++;
    if (frames.current === 4) useCity.getState().set({ progress: 1, sceneReady: true });
  });
  return null;
}

function Pedestal() {
  const ring = useRef<THREE.Mesh>(null);
  const phase = useCity((s) => s.phase);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.8;
  });
  const show = phase === "join" || phase === "verify" || phase === "landing";
  return (
    <group position={[PEDESTAL.x, 0, PEDESTAL.z]} visible={show}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[1.1, 1.25, 0.12, 40]} />
        <meshStandardMaterial color="#1a2030" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh ref={ring} position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.18, 48, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color={[0.6, 2.2, 2.8]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {show && (
        <>
          <spotLight position={[1.5, 5, 4]} angle={0.55} penumbra={0.7} intensity={220} color="#fff3e0" distance={14} />
          <pointLight position={[-2.2, 1.6, -1.6]} intensity={30} color="#4fd1ff" distance={8} />
          <pointLight position={[2.4, 1.2, -1.2]} intensity={20} color="#ffc15e" distance={8} />
        </>
      )}
    </group>
  );
}

export default function Scene() {
  const quality = useCity((s) => s.quality);
  const launch = useCity((s) => s.launch);
  const phase = useCity((s) => s.phase);
  const guest = useCity((s) => s.guest);
  const me = useCity((s) => s.me);
  const high = quality === "high";

  useEffect(() => {
    useCity.getState().set({ progress: Math.max(useCity.getState().progress, 0.45) });
    for (const f of [FONT_DISPLAY, FONT_BOLD, FONT_MONO]) preloadFont({ font: f }, () => {});
  }, []);

  const showPlayer = phase !== "movein" || !!me || guest;

  return (
    <Canvas
      dpr={high ? [1, 1.75] : [0.75, 1]}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false, toneMapping: THREE.NoToneMapping }}
      camera={{ fov: 55, near: 0.3, far: 2400, position: [180, 80, 180] }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.FogExp2("#0a1322", high ? 0.0021 : 0.0028);
        scene.background = new THREE.Color("#04070f");
      }}
    >
      <Clock />
      <Colliders />
      <CameraRig />
      {/* moonlight */}
      <ambientLight intensity={0.25} color="#8fa6d6" />
      <hemisphereLight args={["#5c7bb8", "#1b2418", 0.7]} />
      <directionalLight position={[MOON_DIR.x * 200, MOON_DIR.y * 200 + 100, MOON_DIR.z * 200]} intensity={1.1} color="#c9d8ff" />
      <Sky />
      <Ground />
      <Downtown />
      <Houses />
      <Suspense fallback={null}>
        <Arches />
      </Suspense>
      {showPlayer && <Player />}
      {(phase === "explore" || phase === "movein") && <Neighbours />}
      <Pedestal />
      <ReadySignal />
      <Lamps />
      <Trees />
      <Hills count={high ? 70 : 40} />
      <Aircraft count={6} />
      <Fireflies count={high ? 500 : 180} />
      <ArrivalBeams />
      {launch && <Fireworks />}
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={high ? 0.85 : 0.7} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.7} />
        <Vignette eskil={false} offset={0.3} darkness={0.6} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {high ? <SMAA /> : <></>}
      </EffectComposer>
    </Canvas>
  );
}
