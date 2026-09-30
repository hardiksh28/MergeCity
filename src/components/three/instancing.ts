import * as THREE from "three";

type Setter = (name: string, ...values: number[]) => void;

const color = new THREE.Color();

/** Builds an InstancedMesh with custom per-instance float attributes. */
export function buildInstanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  attrs: Record<string, number>,
  fill: (i: number, m: THREE.Matrix4, set: Setter) => void,
) {
  const g = geometry.clone();
  const arrays: Record<string, Float32Array> = {};
  const n = Math.max(count, 1);
  for (const [name, size] of Object.entries(attrs)) {
    arrays[name] = new Float32Array(n * size);
    g.setAttribute(name, new THREE.InstancedBufferAttribute(arrays[name], size));
  }
  const mesh = new THREE.InstancedMesh(g, material, n);
  mesh.count = count;
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.identity();
    fill(i, m, (name, ...values) => arrays[name].set(values, i * attrs[name]));
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function rgb(hex: string): [number, number, number] {
  color.set(hex);
  return [color.r, color.g, color.b];
}

const q = new THREE.Quaternion();
const e = new THREE.Euler();
const p = new THREE.Vector3();
const s = new THREE.Vector3();

export function place(m: THREE.Matrix4, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rotY = 0, rotX = 0) {
  e.set(rotX, rotY, 0);
  q.setFromEuler(e);
  m.compose(p.set(x, y, z), q, s.set(sx, sy, sz));
}

export const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
