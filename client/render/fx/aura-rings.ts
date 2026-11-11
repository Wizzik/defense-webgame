import { type InstancedMesh, RingGeometry } from "three/webgpu";
import { createFxMesh, disposeMesh, hide, type Rgb, setColor, writeScaled } from "./instances";

const POOL = 8;
const FLOOR_LIFT = 0.05;
const RING_INNER = 0.96;

/** Steady rings on the floor under the carriers of an aura; rewritten every frame from their positions. */
export class AuraRings {
  readonly mesh: InstancedMesh;
  private used = 0;
  private shown = 0;

  constructor() {
    this.mesh = createFxMesh(new RingGeometry(RING_INNER, 1, 64).rotateX(-Math.PI / 2), POOL);
  }

  begin(): void {
    this.used = 0;
  }

  /** Scene coordinates; rings beyond the pool are not drawn. */
  add(x: number, z: number, radius: number, color: Rgb, opacity: number): void {
    if (this.used >= POOL) return;
    const i = this.used++;
    writeScaled(this.mesh.instanceMatrix.array as Float32Array, i, x, FLOOR_LIFT, z, radius, 1, radius);
    setColor(this.mesh.instanceColor!.array as Float32Array, i, color[0], color[1], color[2], opacity);
  }

  /** Hides the rings left over from the last frame and uploads only when something changed or shows. */
  end(): void {
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const c = this.mesh.instanceColor!.array as Float32Array;
    for (let i = this.used; i < this.shown; i++) hide(m, c, i);
    if (this.used === 0 && this.shown === 0) return;
    this.shown = this.used;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    disposeMesh(this.mesh);
  }
}
