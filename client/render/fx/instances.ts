import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  type BufferGeometry,
  InstancedMesh,
  MeshBasicNodeMaterial,
} from "three/webgpu";

/** Linear rgb of a hex colour, the way the material colour would be read. */
export function rgb(hex: number): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

/**
 * Instanced mesh with additive blending: fading an instance colour to black fades it out. The
 * colour attribute is created here (three allocates it on the first `setColorAt`).
 */
export function createFxMesh(geometry: BufferGeometry, capacity: number): InstancedMesh {
  const material = new MeshBasicNodeMaterial({ color: 0xffffff });
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.setColorAt(0, new Color(0));
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.instanceColor!.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  hideAll(mesh);
  return mesh;
}

function hideAll(mesh: InstancedMesh): void {
  const m = mesh.instanceMatrix.array as Float32Array;
  const c = mesh.instanceColor!.array as Float32Array;
  for (let i = 0; i < mesh.count; i++) hide(m, c, i);
}

/** Zero scale (the instance is not drawn) and a black colour. */
export function hide(m: Float32Array, c: Float32Array, i: number): void {
  writeScaled(m, i, 0, 0, 0, 0, 0, 0);
  c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = 0;
}

/** Axis-aligned matrix: scale (sx, sy, sz) and translation (x, y, z). */
export function writeScaled(
  m: Float32Array, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number,
): void {
  const o = i * 16;
  m.fill(0, o, o + 16);
  m[o] = sx;
  m[o + 5] = sy;
  m[o + 10] = sz;
  m[o + 12] = x;
  m[o + 13] = y;
  m[o + 14] = z;
  m[o + 15] = 1;
}

/** Unit box (1 x 1 x 1) turned about y so its long axis runs from (ax, az) to (bx, bz); returns false for a zero length. */
export function writeBeam(
  m: Float32Array, i: number, ax: number, az: number, bx: number, bz: number, y: number, thickness: number,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 1e-4) return false;
  const ux = dx / length;
  const uz = dz / length;
  const o = i * 16;
  m.fill(0, o, o + 16);
  // x axis = (uz, 0, -ux) * thickness, y axis = up * thickness, z axis = direction * length
  m[o] = uz * thickness;
  m[o + 2] = -ux * thickness;
  m[o + 5] = thickness;
  m[o + 8] = ux * length;
  m[o + 10] = uz * length;
  m[o + 12] = (ax + bx) * 0.5;
  m[o + 13] = y;
  m[o + 14] = (az + bz) * 0.5;
  m[o + 15] = 1;
  return true;
}

export function setColor(c: Float32Array, i: number, r: number, g: number, b: number, k: number): void {
  c[i * 3] = r * k;
  c[i * 3 + 1] = g * k;
  c[i * 3 + 2] = b * k;
}

export function disposeMesh(mesh: InstancedMesh): void {
  mesh.geometry.dispose();
  (mesh.material as MeshBasicNodeMaterial).dispose();
  mesh.dispose();
}
