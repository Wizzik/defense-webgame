import { float, color, smoothstep, uv } from "three/tsl";
import { CircleGeometry, DynamicDrawUsage, InstancedMesh, MeshBasicNodeMaterial } from "three/webgpu";
import { AllyKind, type Run } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";

/** The circle is this many times the collision diameter; a ward has no collision, so it gets a fixed size (0.6 scaled by the same 1.6 / 1.1 as the circles). */
const SIZE_FACTOR = 1.6;
const WARD_DIAMETER = 0.87;
/** Opacity at the centre; it falls to 0 at the edge. */
const CENTRE_OPACITY = 0.6;
/** Just above the floor, so the circle neither sinks into it nor hides the hero ring (0.04). */
const LIFT = 0.02;

/** A soft dark circle under every living enemy and every serpent ward; the shadow map covers the rest. `update` does not allocate. */
export class BlobShadows implements RunView {
  readonly mesh: InstancedMesh;

  constructor(capacity: number) {
    const geometry = new CircleGeometry(0.5, 32);
    geometry.rotateX(-Math.PI / 2);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    material.colorNode = color(0x000000);
    // distance from the middle of the circle, 0..1
    const radius = uv().sub(0.5).length().mul(2);
    material.opacityNode = float(CENTRE_OPACITY).mul(float(1).sub(smoothstep(0, 1, radius)));
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(run: Run, alpha: number, _dt: number): void {
    const { enemies, allies } = run;
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const capacity = m.length / 16;
    let n = 0;
    for (let slot = 0; slot < enemies.capacity && n < capacity; slot++) {
      if (enemies.alive[slot] === 0) continue;
      const x = enemies.prevX[slot]! + (enemies.x[slot]! - enemies.prevX[slot]!) * alpha;
      const y = enemies.prevY[slot]! + (enemies.y[slot]! - enemies.prevY[slot]!) * alpha;
      const diameter = 2 * run.data.enemies[enemies.type[slot]!]!.collision * SCENE_SCALE * SIZE_FACTOR;
      write(m, n++, x * SCENE_SCALE, -y * SCENE_SCALE, diameter);
    }
    for (let slot = 0; slot < allies.capacity && n < capacity; slot++) {
      if (allies.alive[slot] === 0 || allies.kind[slot] !== AllyKind.Ward) continue;
      const x = allies.prevX[slot]! + (allies.x[slot]! - allies.prevX[slot]!) * alpha;
      const y = allies.prevY[slot]! + (allies.y[slot]! - allies.prevY[slot]!) * alpha;
      write(m, n++, x * SCENE_SCALE, -y * SCENE_SCALE, WARD_DIAMETER);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicNodeMaterial).dispose();
    this.mesh.dispose();
  }
}

/** Flat on the floor, `size` wide, centred at (x, z). */
function write(m: Float32Array, i: number, x: number, z: number, size: number): void {
  const o = i * 16;
  m.fill(0, o, o + 16);
  m[o] = size;
  m[o + 5] = 1;
  m[o + 10] = size;
  m[o + 12] = x;
  m[o + 13] = LIFT;
  m[o + 14] = z;
  m[o + 15] = 1;
}
