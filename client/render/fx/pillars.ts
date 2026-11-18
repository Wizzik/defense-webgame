import { BoxGeometry, type InstancedMesh } from "three/webgpu";
import { createFxMesh, disposeMesh, hide, type Rgb, setColor, writeScaled } from "./instances";
import { FxPool } from "./pool";

const PILLAR_POOL = 16;
const PILLAR_LIFE = 0.28;
/** Height of a pillar in scene units; it shrinks towards the floor as it fades. */
const PILLAR_HEIGHT = 5;

/** A short vertical flash from above onto a point: the strike of an instant spell. */
export class PillarFx {
  readonly mesh: InstancedMesh;
  private readonly pool = new FxPool(PILLAR_POOL, PILLAR_LIFE);
  private readonly x = new Float32Array(PILLAR_POOL);
  private readonly z = new Float32Array(PILLAR_POOL);
  private readonly width = new Float32Array(PILLAR_POOL);
  private readonly color: Rgb;
  /** True when the last write showed something, so one more write must hide it. */
  private shown = false;

  constructor(color: Rgb) {
    this.color = color;
    this.mesh = createFxMesh(new BoxGeometry(1, 1, 1), PILLAR_POOL);
  }

  /** Scene coordinates; `width` in scene units. */
  add(now: number, x: number, z: number, width: number): void {
    const i = this.pool.add(now);
    this.x[i] = x;
    this.z[i] = z;
    this.width[i] = width;
  }

  /** Skips the write and the GPU upload while no pillar is alive. */
  write(now: number): void {
    const live = this.pool.liveCount(now) > 0;
    if (!live && !this.shown) return;
    this.shown = live;
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const c = this.mesh.instanceColor!.array as Float32Array;
    const [r, g, b] = this.color;
    for (let i = 0; i < PILLAR_POOL; i++) {
      const age = this.pool.age(i, now);
      if (age < 0) {
        hide(m, c, i);
        continue;
      }
      const t = age / PILLAR_LIFE;
      const height = PILLAR_HEIGHT * (1 - t * 0.6);
      const w = this.width[i]! * (1 - t * 0.5);
      writeScaled(m, i, this.x[i]!, height * 0.5, this.z[i]!, w, height, w);
      setColor(c, i, r!, g!, b!, 1 - t);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }

  reset(): void {
    this.pool.reset();
  }

  dispose(): void {
    disposeMesh(this.mesh);
  }
}
