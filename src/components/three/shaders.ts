import * as THREE from "three";

// All city surfaces are unlit custom shaders: procedural windows, neon trims
// and fog. No textures to download, and bloom picks up anything above 1.0.

export const shared = {
  uTime: { value: 0 },
  uLaunch: { value: 0 },
};

const HASH = /* glsl */ `
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

function fogUniforms() {
  return THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
}

// ------------------------------------------------------------------ buildings
export function makeBuildingMaterial(opts: { winW: number; winH: number; scan?: number; edge?: number }) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...fogUniforms(),
      uTime: shared.uTime,
      uLaunch: shared.uLaunch,
      uWin: { value: new THREE.Vector2(opts.winW, opts.winH) },
      uScan: { value: opts.scan ?? 0 },
      uEdge: { value: opts.edge ?? 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute vec4 aData; // lit ratio, seed, lit floors (-1 = use ratio), glow
      varying vec3 vLocal; varying vec3 vSize; varying vec3 vN; varying vec3 vColor; varying vec4 vData; varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){
        vec3 size = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vSize = size;
        vLocal = position * size;
        vN = normal;
        vColor = aColor;
        vData = aData;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uLaunch; uniform vec2 uWin; uniform float uScan; uniform float uEdge;
      varying vec3 vLocal; varying vec3 vSize; varying vec3 vN; varying vec3 vColor; varying vec4 vData; varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${HASH}
      void main(){
        vec3 n = normalize(vN);
        float side = step(abs(n.y), 0.5);
        vec3 hs = vSize * 0.5;
        float u = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
        float across = abs(n.x) > 0.5 ? hs.z : hs.x;
        float v = vLocal.y;
        float edgeDist = across - abs(u);
        float topDist = vSize.y - v;

        vec3 col = vec3(0.012, 0.010, 0.028) * (0.7 + 0.6 * (0.5 + 0.5 * n.y)) + vColor * 0.012;

        if (side > 0.5) {
          vec2 g = vec2((u + 200.0) / uWin.x, v / uWin.y);
          vec2 cell = floor(g);
          vec2 f = fract(g);
          float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.78);
          win *= step(0.5, edgeDist) * step(0.6, topDist) * step(0.5, v);
          float faceId = n.x * 3.1 + n.z * 7.7;
          float r = hash12(cell + vec2(vData.y * 13.1, faceId));
          float lit = vData.z >= 0.0 ? step(cell.y + 0.5, vData.z) : step(r, vData.x);
          float flick = step(0.992, hash12(cell + floor(uTime * 1.5 + r * 7.0)));
          lit = clamp(abs(lit - flick * step(0.5, vData.x)), 0.0, 1.0);
          lit = max(lit, uLaunch * step(r, 0.9));
          vec3 warm = vec3(1.0, 0.62, 0.3);
          vec3 cool = vec3(0.35, 0.85, 1.0);
          vec3 wc = vData.z >= 0.0 ? mix(vColor, vec3(1.0), 0.25) : mix(warm, cool, step(0.55, hash12(cell * 1.7 + vData.y)));
          vec3 off = vec3(0.02, 0.025, 0.05) + vColor * 0.02;
          col = mix(col, mix(off, wc * 1.9, lit), win);
          // vertical neon trims on corners + a cap line under the roof
          float trim = smoothstep(0.22, 0.0, edgeDist) + smoothstep(0.3, 0.0, topDist);
          col += vColor * trim * 2.6 * uEdge * (0.35 + 0.65 * vData.w);
          // scanning band sweeping up the tower
          float band = fract(v / max(vSize.y, 1.0) - uTime * 0.07 - vData.y);
          col += vColor * smoothstep(0.012, 0.0, abs(band - 0.5)) * uScan * 1.6;
        } else if (n.y > 0.5) {
          vec2 rg = abs(fract(vec2(vLocal.x, vLocal.z) / 2.0) - 0.5);
          col += vColor * smoothstep(0.05, 0.0, min(rg.x, rg.y)) * 0.25;
          float rim = min(hs.x - abs(vLocal.x), hs.z - abs(vLocal.z));
          col += vColor * smoothstep(0.25, 0.0, rim) * 2.0 * uEdge;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

// ---------------------------------------------------------------------- roofs
export function makeRoofMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...fogUniforms(), uTime: shared.uTime },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aGlow;
      varying float vY; varying vec3 vColor; varying float vGlow;
      #include <fog_pars_vertex>
      void main(){
        vY = position.y; vColor = aColor; vGlow = aGlow;
        vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vY; varying vec3 vColor; varying float vGlow;
      #include <fog_pars_fragment>
      void main(){
        vec3 col = vec3(0.03, 0.02, 0.06);
        col += vColor * smoothstep(0.1, 0.0, vY) * (1.0 + 2.2 * vGlow);
        col += vColor * smoothstep(0.85, 1.0, vY) * 3.0 * vGlow;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

// ------------------------------------------------ flat emissive (instanced)
export function makeGlowMaterial(opts: { wave?: boolean; transparent?: boolean } = {}) {
  return new THREE.ShaderMaterial({
    fog: true,
    transparent: !!opts.transparent,
    depthWrite: !opts.transparent,
    side: THREE.DoubleSide,
    uniforms: { ...fogUniforms(), uTime: shared.uTime },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec3 aColor; attribute float aGlow;
      varying vec3 vColor; varying float vGlow; varying vec2 vUv;
      #include <fog_pars_vertex>
      void main(){
        vColor = aColor; vGlow = aGlow; vUv = uv;
        vec3 p = position;
        ${opts.wave ? "p.z += sin(uv.x * 6.0 - uTime * 5.0 + instanceMatrix[3].x) * 0.12 * uv.x;" : ""}
        vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vGlow; varying vec2 vUv;
      #include <fog_pars_fragment>
      void main(){
        gl_FragColor = vec4(vColor * vGlow, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

// --------------------------------------------------------------------- ground
export function makeGroundMaterial(o: { block: number; road: number; downtownR: number; mainR: number; cityR: number }) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...fogUniforms(),
      uTime: shared.uTime,
      uLaunch: shared.uLaunch,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uLaunch;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${HASH}
      const float B = ${o.block.toFixed(1)};
      const float R = ${o.road.toFixed(1)};
      void main(){
        vec2 p = vWorld.xz;
        float d = length(p);
        // district tint
        vec3 tint = d < ${o.downtownR.toFixed(1)} ? vec3(0.13, 0.95, 1.0) : d < ${o.mainR.toFixed(1)} ? vec3(1.0, 0.17, 0.84) : vec3(0.55, 0.36, 1.0);
        float inCity = smoothstep(${(o.cityR + 14).toFixed(1)}, ${(o.cityR - 6).toFixed(1)}, d);

        vec2 q = p / B + 0.5;              // roads sit on integer lines of q
        vec2 fq = abs(fract(q) - 0.5) * B;   // distance from block centre (0 .. B/2)
        vec2 toRoad = B * 0.5 - fq;          // distance to road centreline
        float roadX = step(toRoad.x, R * 0.5);
        float roadZ = step(toRoad.y, R * 0.5);
        float road = max(roadX, roadZ) * inCity;

        vec3 col = vec3(0.008, 0.007, 0.018);
        // lots: faint grid
        vec2 g = abs(fract(p / 2.0) - 0.5);
        col += tint * smoothstep(0.03, 0.0, min(g.x, g.y)) * 0.06 * inCity * (1.0 - road);
        // sidewalk curb glow
        float curb = min(abs(toRoad.x - R * 0.5), abs(toRoad.y - R * 0.5));
        col += tint * smoothstep(0.18, 0.0, curb) * 1.6 * inCity;
        // asphalt + wet puddle sheen
        float puddle = smoothstep(0.55, 0.8, hash12(floor(p * 0.5)) * hash12(floor(p * 0.13) + 3.0) * 1.6);
        vec3 asphalt = vec3(0.02, 0.018, 0.035) + tint * 0.02 + vec3(0.35, 0.05, 0.4) * puddle * 0.08;
        col = mix(col, asphalt, road);
        // dashed centre lines with a pulse travelling along them
        float lineX = roadX * (1.0 - roadZ) * smoothstep(0.12, 0.0, toRoad.x) * step(0.5, fract(p.y / 3.0));
        float lineZ = roadZ * (1.0 - roadX) * smoothstep(0.12, 0.0, toRoad.y) * step(0.5, fract(p.x / 3.0));
        col += vec3(1.0, 0.75, 0.25) * (lineX + lineZ) * 1.4 * inCity;
        float pulse = fract(d / 60.0 - uTime * 0.25);
        col += tint * road * smoothstep(0.03, 0.0, abs(pulse - 0.5)) * 1.2;
        // city edge ring
        col += vec3(1.0, 0.2, 0.7) * smoothstep(1.2, 0.0, abs(d - ${(o.cityR + 10).toFixed(1)})) * 3.0;
        // outer wasteland: synth grid to the horizon
        vec2 wg = abs(fract(p / 12.0) - 0.5);
        col += vec3(0.6, 0.1, 1.0) * smoothstep(0.02, 0.0, min(wg.x, wg.y)) * 0.9 * (1.0 - inCity);
        col *= 1.0 + uLaunch * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

// ------------------------------------------------------------------------ sky
export function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: shared.uTime, uLaunch: shared.uLaunch },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uLaunch;
      varying vec3 vDir;
      ${HASH}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zenith = vec3(0.012, 0.004, 0.035);
        vec3 mid = vec3(0.09, 0.015, 0.16);
        vec3 horizon = vec3(0.85, 0.12, 0.42);
        vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.18, h));
        col = mix(col, zenith, smoothstep(0.18, 0.7, h));
        // synthwave sun sitting on the horizon behind downtown
        vec3 sunDir = normalize(vec3(0.0, 0.1, -1.0));
        float a = acos(clamp(dot(d, sunDir), -1.0, 1.0));
        float sunR = 0.24;
        float inSun = smoothstep(sunR, sunR - 0.004, a);
        float sy = (h - 0.1 + sunR) / (2.0 * sunR);
        float stripes = step(0.5, fract(sy * 14.0 - uTime * 0.15)) + step(0.45, sy);
        vec3 sunCol = mix(vec3(1.0, 0.1, 0.55), vec3(1.0, 0.85, 0.2), clamp(sy, 0.0, 1.0));
        col = mix(col, sunCol * 2.4, inSun * clamp(stripes, 0.0, 1.0) * step(-0.01, h));
        col += vec3(1.0, 0.2, 0.5) * exp(-a * 5.0) * 0.5;
        // stars
        vec2 sp = vec2(atan(d.z, d.x) * 120.0, h * 240.0);
        float s = hash12(floor(sp));
        float tw = 0.5 + 0.5 * sin(uTime * 2.0 + s * 40.0);
        col += vec3(0.8, 0.85, 1.0) * step(0.9975, s) * smoothstep(0.1, 0.5, h) * tw * 1.3;
        // aurora ribbons
        float au = sin(d.x * 6.0 + uTime * 0.2) * 0.05 + 0.42;
        col += vec3(0.1, 0.9, 0.8) * smoothstep(0.06, 0.0, abs(h - au)) * 0.25 * (0.5 + 0.5 * sin(d.z * 9.0 + uTime * 0.5));
        col = mix(col, col * 1.5 + vec3(0.2, 0.0, 0.2), uLaunch * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// ----------------------------------------------------------------- hologram
export function makeHoloMaterial(color: string, opacity = 0.5) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: shared.uTime, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorld;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vWorld;
      void main(){
        float scan = 0.55 + 0.45 * sin(vWorld.y * 6.0 - uTime * 6.0);
        float fade = smoothstep(1.0, 0.0, vUv.y) ;
        float edge = smoothstep(0.0, 0.06, vUv.y);
        gl_FragColor = vec4(uColor * 2.0 * scan, uOpacity * fade * edge);
      }
    `,
  });
}
