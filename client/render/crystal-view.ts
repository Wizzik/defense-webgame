import {
  type BufferGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  ExtrudeGeometry,
  InstancedMesh,
  MeshStandardNodeMaterial,
  OctahedronGeometry,
  Shape,
} from "three/webgpu";
import { type CrystalStore, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";

const RADIUS = 0.18;
const HOVER = 0.3;
const BOB_HEIGHT = 0.06;
const BOB_SPEED = 3;
const SPIN_SPEED = 1.5;

/** How a pickup store is drawn. */
export interface PickupLook {
  geometry: BufferGeometry;
  color: number;
  emissive: number;
  emissiveIntensity: number;
}

/** XP crystals: a blue octahedron. */
export function crystalLook(): PickupLook {
  return { geometry: new OctahedronGeometry(RADIUS), color: 0x22aacc, emissive: 0x00ccff, emissiveIntensity: 1.2 };
}

/** Gold coins: a pale gold disc on its edge, so the spin shows its face. */
export function coinLook(): PickupLook {
  const geometry = new CylinderGeometry(0.15, 0.15, 0.04, 14);
  geometry.rotateZ(Math.PI / 2);
  return { geometry, color: 0xe8c860, emissive: 0xb89a3c, emissiveIntensity: 0.7 };
}

/** Hearts: a small crimson heart, a little narrower than a crystal (spec 2026-11-19 sustain). */
export function heartLook(): PickupLook {
  const shape = new Shape();
  shape.moveTo(0, -0.5);
  shape.bezierCurveTo(-0.15, -0.3, -0.6, -0.1, -0.6, 0.25);
  shape.bezierCurveTo(-0.6, 0.55, -0.2, 0.65, 0, 0.35);
  shape.bezierCurveTo(0.2, 0.65, 0.6, 0.55, 0.6, 0.25);
  shape.bezierCurveTo(0.6, -0.1, 0.15, -0.3, 0, -0.5);
  const geometry = new ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(0, 0, -0.15);
  // the shape is 1.2 wide: about 0.3 in the scene, a little narrower than a crystal (0.36)
  geometry.scale(0.25, 0.25, 0.25);
  return { geometry, color: 0xc8303e, emissive: 0xe0444e, emissiveIntensity: 0.8 };
}

/** The pickups of one store (XP crystals, gold coins or hearts): one instanced mesh, bobbing and turning. `update` does not allocate. */
export class CrystalView implements RunView {
  readonly mesh: InstancedMesh;
  private readonly store: (run: Run) => CrystalStore;

  constructor(capacity: number, store: (run: Run) => CrystalStore, look: PickupLook) {
    this.store = store;
    const material = new MeshStandardNodeMaterial({
      color: look.color,
      emissive: look.emissive,
      emissiveIntensity: look.emissiveIntensity,
      roughness: 0.3,
    });
    this.mesh = new InstancedMesh(look.geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(run: Run, alpha: number, _dt: number): void {
    const crystals = this.store(run);
    const seconds = (run.tick + alpha) / TICKS_PER_SECOND;
    const m = this.mesh.instanceMatrix.array as Float32Array;
    let n = 0;
    for (let slot = 0; slot < crystals.capacity; slot++) {
      if (crystals.alive[slot] === 0) continue;
      const x = crystals.prevX[slot] + (crystals.x[slot] - crystals.prevX[slot]) * alpha;
      const y = crystals.prevY[slot] + (crystals.y[slot] - crystals.prevY[slot]) * alpha;
      const cos = Math.cos(seconds * SPIN_SPEED + slot);
      const sin = Math.sin(seconds * SPIN_SPEED + slot);
      const o = n * 16;
      m[o] = cos;
      m[o + 1] = 0;
      m[o + 2] = -sin;
      m[o + 3] = 0;
      m[o + 4] = 0;
      m[o + 5] = 1;
      m[o + 6] = 0;
      m[o + 7] = 0;
      m[o + 8] = sin;
      m[o + 9] = 0;
      m[o + 10] = cos;
      m[o + 11] = 0;
      m[o + 12] = x * SCENE_SCALE;
      m[o + 13] = HOVER + Math.sin(seconds * BOB_SPEED + slot) * BOB_HEIGHT;
      m[o + 14] = -y * SCENE_SCALE;
      m[o + 15] = 1;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardNodeMaterial).dispose();
    this.mesh.dispose();
  }
}
