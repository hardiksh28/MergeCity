import * as THREE from "three";

// All city surfaces use small custom shaders: moonlit shading, procedural
// windows, grass and roads. No textures to download, and bloom picks up
// anything above 1.0 (lit windows, lamps, beacons).

export const shared = {
  uTime: { value: 0 },
  uLaunch: { value: 0 },
};

/** Direction towards the moon. Sky and surfaces agree on it. */
export const MOON_DIR = new THREE.Vector3(-0.5, 0.42, -0.75).normalize();
const MOON = `vec3(${MOON_DIR.x.toFixed(4)}, ${MOON_DIR.y.toFixed(4)}, ${MOON_DIR.z.toFixed(4)})`;
const MOON_LIGHT = `normalize(vec3(${MOON_DIR.x.toFixed(4)}, ${(MOON_DIR.y + 0.5).toFixed(4)}, ${MOON_DIR.z.toFixed(4)}))`;

const HASH = /* glsl */ `
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float noise2(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }
`;

// Houses "grow" out of the ground when someone registers.
const RISE = /* glsl */ `
  float rise = clamp((uTime - aBorn) / 1.6, 0.0, 1.0);
  rise = 1.0 - pow(1.0 - rise, 3.0);
`;

function fogUniforms() {
  return THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
}

// ------------------------------------------------------------------ buildings
export function makeBuildingMaterial(opts: { winW: number; winH: number; glass?: boolean }) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...fogUniforms(),
      uTime: shared.uTime,
      uLaunch: shared.uLaunch,
      uWin: { value: new THREE.Vector2(opts.winW, opts.winH) },
      uGlass: { value: opts.glass ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec3 aColor;  // wall
      attribute vec3 aTrim;   // accent
      attribute vec4 aData;   // lit ratio, seed, lit floors (-1 = use ratio), trim glow
      attribute float aBorn;
      varying vec3 vLocal; varying vec3 vSize; varying vec3 vN; varying vec3 vColor; varying vec3 vTrim; varying vec4 vData;
      #include <fog_pars_vertex>
      void main(){
        vec3 size = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vSize = size;
        vLocal = position * size;
        vN = normal;
        vColor = aColor; vTrim = aTrim; vData = aData;
        ${RISE}
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        wp.y *= rise;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uLaunch; uniform vec2 uWin; uniform float uGlass;
      varying vec3 vLocal; varying vec3 vSize; varying vec3 vN; varying vec3 vColor; varying vec3 vTrim; varying vec4 vData;
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

        // moonlight + sky ambient + a little ground occlusion
        float diff = max(dot(n, ${MOON_LIGHT}), 0.0);
        vec3 col = vColor * (0.16 + 0.62 * diff) + vec3(0.015, 0.025, 0.05) * (0.6 + 0.4 * n.y);
        col *= mix(0.45, 1.0, smoothstep(0.0, 2.2, v));
        // glass towers pick up a faint sky gradient
        col += uGlass * vec3(0.02, 0.04, 0.08) * smoothstep(0.0, vSize.y, v) * side;

        if (side > 0.5) {
          vec2 g = vec2((u + 200.0) / uWin.x, v / uWin.y);
          vec2 cell = floor(g);
          vec2 f = fract(g);
          float frame = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.78);
          frame *= step(0.55, edgeDist) * step(0.6, topDist) * step(0.6, v);
          float faceId = n.x * 3.1 + n.z * 7.7;
          float r = hash12(cell + vec2(vData.y * 13.1, faceId));
          float lit = vData.z >= 0.0 ? step(cell.y + 0.5, vData.z) : step(r, vData.x);
          lit = max(lit, uLaunch * step(r, 0.92));
          vec3 warm = mix(vec3(1.0, 0.68, 0.36), vec3(1.0, 0.82, 0.55), hash12(cell * 3.1 + vData.y));
          vec3 cool = vec3(0.62, 0.82, 1.0);
          vec3 wc = vData.z >= 0.0 ? mix(vTrim, vec3(1.0), 0.35) : mix(warm, cool, step(0.82, hash12(cell * 1.7 + vData.y)));
          // unlit glass reflects the night sky
          vec3 off = vec3(0.035, 0.05, 0.085) + vec3(0.02, 0.03, 0.05) * f.y;
          // interior gradient so lit windows aren't flat
          float inner = 0.75 + 0.35 * f.y;
          vec3 win = mix(off, wc * 1.7 * inner, lit);
          col = mix(col, win, frame);
          // window sills catch moonlight
          float sill = step(0.22, f.x) * step(f.x, 0.78) * smoothstep(0.3, 0.26, f.y) * step(0.24, f.y);
          col += vec3(0.05, 0.06, 0.08) * sill * step(0.55, edgeDist) * step(0.6, v);
          // corner trims + cap line
          float trim = smoothstep(0.12, 0.0, edgeDist) + smoothstep(0.16, 0.0, topDist);
          col = mix(col, vTrim * (0.35 + 1.6 * vData.w), clamp(trim, 0.0, 1.0));
        } else if (n.y > 0.5) {
          float rim = min(hs.x - abs(vLocal.x), hs.z - abs(vLocal.z));
          col = vColor * 0.35 + vec3(0.02, 0.03, 0.05);
          col = mix(col, vTrim * (0.35 + 1.4 * vData.w), smoothstep(0.2, 0.0, rim));
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
      uniform float uTime;
      attribute vec3 aColor; attribute vec3 aTrim; attribute float aGlow; attribute float aBorn;
      varying float vY; varying vec3 vColor; varying vec3 vTrim; varying float vGlow; varying vec3 vN;
      #include <fog_pars_vertex>
      void main(){
        vY = position.y; vColor = aColor; vTrim = aTrim; vGlow = aGlow;
        vN = normalize(mat3(instanceMatrix) * normal);
        ${RISE}
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        wp.y *= rise;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vY; varying vec3 vColor; varying vec3 vTrim; varying float vGlow; varying vec3 vN;
      #include <fog_pars_fragment>
      void main(){
        vec3 n = normalize(vN);
        float diff = max(dot(n, ${MOON_LIGHT}), 0.0);
        // shingle rows
        float rows = 0.85 + 0.15 * step(0.5, fract(vY * 7.0));
        vec3 col = vColor * (0.18 + 0.7 * diff) * rows + vec3(0.01, 0.015, 0.03);
        col = mix(col, vTrim * (0.4 + 1.5 * vGlow), smoothstep(0.07, 0.0, vY));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

// ------------------------------------------------ flat emissive (instanced)
export function makeGlowMaterial(opts: { wave?: boolean; lit?: boolean } = {}) {
  return new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: { ...fogUniforms(), uTime: shared.uTime },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec3 aColor; attribute float aGlow;
      varying vec3 vColor; varying float vGlow; varying vec2 vUv; varying vec3 vN;
      #include <fog_pars_vertex>
      void main(){
        vColor = aColor; vGlow = aGlow; vUv = uv;
        vN = normalize(mat3(instanceMatrix) * normal);
        vec3 p = position;
        ${opts.wave ? "p.z += sin(uv.x * 6.0 - uTime * 4.0 + instanceMatrix[3].x) * 0.12 * uv.x;" : ""}
        vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vGlow; varying vec2 vUv; varying vec3 vN;
      #include <fog_pars_fragment>
      void main(){
        vec3 c = vColor * vGlow;
        ${opts.lit ? `c *= 0.35 + 0.75 * max(dot(normalize(vN), ${MOON_LIGHT}), 0.0);` : ""}
        gl_FragColor = vec4(c, 1.0);
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
    uniforms: { ...fogUniforms(), uTime: shared.uTime, uLaunch: shared.uLaunch },
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
        float inCity = smoothstep(${(o.cityR + 16).toFixed(1)}, ${(o.cityR + 4).toFixed(1)}, d);
        float paved = step(d, ${o.downtownR.toFixed(1)});

        vec2 q = p / B + 0.5;
        vec2 fq = abs(fract(q) - 0.5) * B;
        vec2 toRoad = B * 0.5 - fq;              // distance to road centreline
        float roadX = step(toRoad.x, R * 0.5);
        float roadZ = step(toRoad.y, R * 0.5);
        float road = max(roadX, roadZ) * inCity;
        float walkX = step(toRoad.x, R * 0.5 + 1.5);
        float walkZ = step(toRoad.y, R * 0.5 + 1.5);
        float walk = max(walkX, walkZ) * inCity * (1.0 - road);

        // grass: two octaves of value noise, moonlit
        float gn = noise2(p * 0.35) * 0.6 + noise2(p * 1.7) * 0.4;
        vec3 grass = mix(vec3(0.028, 0.055, 0.035), vec3(0.05, 0.09, 0.05), gn);
        // wild land outside the city is darker
        vec3 wild = mix(vec3(0.015, 0.03, 0.022), vec3(0.03, 0.05, 0.03), noise2(p * 0.08));
        vec3 col = mix(wild, grass, inCity);
        // downtown + plaza are paved in stone tiles
        vec2 tile = abs(fract(p / 2.5) - 0.5);
        vec3 stone = vec3(0.07, 0.075, 0.09) * (0.85 + 0.15 * hash12(floor(p / 2.5)));
        stone *= 0.8 + 0.2 * smoothstep(0.0, 0.03, min(tile.x, tile.y));
        col = mix(col, stone, paved);

        // sidewalks
        vec2 slab = abs(fract(p / 1.5) - 0.5);
        vec3 concrete = vec3(0.11, 0.115, 0.13) * (0.85 + 0.15 * smoothstep(0.0, 0.04, min(slab.x, slab.y)));
        col = mix(col, concrete, walk);
        // curb highlight
        float curb = min(abs(toRoad.x - R * 0.5), abs(toRoad.y - R * 0.5));
        col += vec3(0.08, 0.09, 0.11) * smoothstep(0.1, 0.0, curb) * inCity;

        // asphalt with subtle wet sheen
        float wet = noise2(p * 0.2);
        vec3 asphalt = vec3(0.035, 0.04, 0.05) + vec3(0.02, 0.03, 0.05) * smoothstep(0.6, 0.9, wet);
        col = mix(col, asphalt, road);
        float lineX = roadX * (1.0 - roadZ) * smoothstep(0.1, 0.0, toRoad.x) * step(0.5, fract(p.y / 4.0));
        float lineZ = roadZ * (1.0 - roadX) * smoothstep(0.1, 0.0, toRoad.y) * step(0.5, fract(p.x / 4.0));
        col += vec3(0.6, 0.55, 0.4) * (lineX + lineZ) * inCity;
        // zebra crossings at intersections
        float inter = roadX * roadZ * inCity;
        float zebra = step(0.5, fract((p.x + p.y) * 0.9)) * step(R * 0.5 - 1.2, max(abs(toRoad.x), abs(toRoad.y)));
        col = mix(col, vec3(0.2, 0.21, 0.23), inter * zebra * 0.6);

        col *= 1.0 + uLaunch * 0.5;
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
        vec3 zenith = vec3(0.004, 0.008, 0.022);
        vec3 mid = vec3(0.012, 0.024, 0.055);
        vec3 horizon = vec3(0.028, 0.045, 0.08);
        vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.2, h));
        col = mix(col, zenith, smoothstep(0.2, 0.8, h));
        // faint warm city glow on the horizon
        col += vec3(0.06, 0.045, 0.03) * exp(-max(h, 0.0) * 18.0);

        // moon
        vec3 m = ${MOON};
        float a = acos(clamp(dot(d, m), -1.0, 1.0));
        float disc = smoothstep(0.052, 0.048, a);
        vec2 mp = vec2(dot(d, normalize(cross(m, vec3(0,1,0)))), d.y - m.y) * 60.0;
        float craters = 0.82 + 0.18 * noise2(mp * 1.5);
        col = mix(col, vec3(1.0, 0.97, 0.9) * 2.2 * craters, disc);
        col += vec3(0.5, 0.6, 0.8) * exp(-a * 9.0) * 0.35;
        col += vec3(0.25, 0.3, 0.45) * exp(-a * 2.5) * 0.12;

        // stars, denser up high, twinkling
        vec2 sp = vec2(atan(d.z, d.x) * 160.0, h * 300.0);
        float s = hash12(floor(sp));
        vec2 sf = fract(sp) - 0.5;
        float star = step(0.9965, s) * smoothstep(0.35, 0.0, length(sf));
        float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 60.0);
        col += vec3(0.85, 0.9, 1.0) * star * tw * smoothstep(0.03, 0.35, h) * 1.6 * (1.0 - disc);
        // milky way band
        float band = exp(-pow((d.x * 0.6 + d.y - 0.55) * 3.2, 2.0));
        col += vec3(0.05, 0.06, 0.09) * band * noise2(vec2(atan(d.z, d.x) * 8.0, h * 10.0)) * smoothstep(0.05, 0.4, h);

        col += vec3(0.05, 0.04, 0.02) * uLaunch;
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
        float shimmer = 0.8 + 0.2 * sin(vWorld.y * 0.8 - uTime * 3.0);
        float fade = smoothstep(1.0, 0.0, vUv.y);
        float edge = smoothstep(0.0, 0.04, vUv.y);
        gl_FragColor = vec4(uColor * 1.6 * shimmer, uOpacity * fade * edge);
      }
    `,
  });
}
