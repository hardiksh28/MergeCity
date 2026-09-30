"use client";

import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { preloadFont } from "troika-three-text";
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useCity } from "@/lib/store";
import { rebuildColliders } from "@/lib/physics";
import { shared } from "./shaders";
import { Arches, ArrivalBeams, Backdrop, Fireworks, FlyingCars, Ground, Lamps, Rain, Sky, Trees } from "./Environment";
import { Downtown } from "./Downtown";
import { Houses } from "./Houses";
import { Neighbours, Player } from "./Player";
import { CameraRig, PEDESTAL } from "./CameraRig";
import { FONT_BOLD, FONT_DISPLAY, FONT_MONO } from "./fonts";

function Clock() {
  useFrame(({ clock }, dt) => {
    shared.uTime.value = clock.elapsedTime;
    const target = useCity.getState().launch ? 1 : 0;
    shared.uLaunch.value += (target - shared.uLaunch.value) * Math.min(1, dt * 1.5);
  });
  return null;
}

function Colliders() {
  const residents = useCity((s) => s.residents);
  useEffect(() => rebuildColliders(residents), [residents]);
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
        <meshBasicMaterial color="#0b0616" />
      </mesh>
      <mesh ref={ring} position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.18, 48, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color={[0.6, 4, 4.4]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {show && (
        <>
          <spotLight position={[1.5, 5, 4]} angle={0.55} penumbra={0.7} intensity={260} color="#fff0fb" distance={14} />
          <pointLight position={[-2.2, 1.6, -1.6]} intensity={40} color="#22f3ff" distance={8} />
          <pointLight position={[2.4, 1.2, -1.2]} intensity={30} color="#ff2bd6" distance={8} />
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
        scene.fog = new THREE.FogExp2("#12041f", high ? 0.0026 : 0.0034);
        scene.background = new THREE.Color("#05020c");
      }}
    >
      <Clock />
      <Colliders />
      <CameraRig />
      <ambientLight intensity={0.35} color="#8a6bff" />
      <hemisphereLight args={["#6a3cff", "#ff2bd6", 0.5]} />
      <directionalLight position={[-60, 120, 80]} intensity={0.6} color="#b8c6ff" />
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
      <Backdrop count={high ? 320 : 160} />
      <FlyingCars count={high ? 220 : 90} />
      <Rain count={high ? 3500 : 900} />
      <ArrivalBeams />
      {launch && <Fireworks />}
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={high ? 1.25 : 0.9} luminanceThreshold={0.85} luminanceSmoothing={0.2} radius={0.75} />
        <ChromaticAberration offset={new THREE.Vector2(high ? 0.0009 : 0, high ? 0.0006 : 0)} radialModulation={false} modulationOffset={0} blendFunction={BlendFunction.NORMAL} />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
        {high ? <Noise opacity={0.12} blendFunction={BlendFunction.OVERLAY} /> : <></>}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
