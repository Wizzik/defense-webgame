import { type InstancedMesh, SphereGeometry } from "three/webgpu";
import { type Run } from "../../../sim";
import type { RunView } from "../../game/session";
import { SCENE_SCALE } from "../coords";
import { createFxMesh, disposeMesh, rgb, writeScaled } from "./instances";

/** Radius of a bolt in scene units. */
const BOLT_RADIUS = 0.2;
const BOLT_COLOR = 0xa6ff7a;
const BOLT_HEIGHT = 0.6;

/** Live homing bolts as glowing spheres, interpolated between steps. `update` does not allocate. */
export class ProjectileView implements RunView {
  readonly mesh: InstancedMesh;
  private shown = 0;

  constructor(capacity: number) {
    this.mesh = createFxMesh(new SphereGeometry(0.5, 12, 8), capacity);
    const c = this.mesh.instanceColor!.array as Float32Array;
    const [r, g, b] = rgb(BOLT_COLOR);
    for (let i = 0; i < capacity; i++) {
      c[i * 3] = r;
      c[i * 3 + 1] = g;
      c[i * 3 + 2] = b;
    }
    this.mesh.instanceColor!.needsUpdate = true;
    this.mesh.count = 0;
  }

  update(run: Run, alpha: number, _dt: number): void {
    const { projectiles } = run;
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const size = 2 * BOLT_RADIUS;
    let n = 0;
    for (let i = 0; i < projectiles.capacity; i++) {
      if (projectiles.alive[i] === 0) continue;
      const x = projectiles.prevX[i]! + (projectiles.x[i]! - projectiles.prevX[i]!) * alpha;
      const y = projectiles.prevY[i]! + (projectiles.y[i]! - projectiles.prevY[i]!) * alpha;
      writeScaled(m, n, x * SCENE_SCALE, BOLT_HEIGHT, -y * SCENE_SCALE, size, size, size);
      n++;
    }
    this.mesh.count = n;
    // nothing to upload while no bolt flies
    if (n > 0 || this.shown > 0) this.mesh.instanceMatrix.needsUpdate = true;
    this.shown = n;
  }

  dispose(): void {
    disposeMesh(this.mesh);
  }
}
