import { CircleGeometry, type InstancedMesh } from "three/webgpu";
import type { Run } from "../../../sim";
import { TICKS_PER_SECOND } from "../../../sim";
import { SCENE_SCALE } from "../coords";
import { createFxMesh, disposeMesh, hide, type Rgb, writeScaled } from "./instances";

/** Over the floor and the slam rings' fills, under every figure. */
const POOL_LIFT = 0.07;
/** A pool shrinks away over its last FADE_TICKS steps. */
const FADE_TICKS = TICKS_PER_SECOND;

/**
 * The meteors' pools of green fire (difficulties plan 3b): one additive disc per burning pool of `run.hazard`, read
 * every frame (no events), flickering a little; a new run draws only its own pools.
 */
export class FirePoolFx {
  readonly mesh: InstancedMesh;
  /** Discs drawn in the last write, for `__game.render.pools`. */
  visible = 0;

  constructor(private readonly capacity: number) {
    this.mesh = createFxMesh(new CircleGeometry(1, 32).rotateX(-Math.PI / 2), capacity);
  }

  /** Draws the pools of `run` in `color` with radius `radius` (sim units) at `now` seconds (flicker). */
  write(run: Run, color: Rgb | null, radius: number, now: number): void {
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const c = this.mesh.instanceColor!.array as Float32Array;
    const h = run.hazard;
    let n = 0;
    for (let i = 0; i < this.capacity; i++) {
      const ticks = i < h.poolTicks.length ? h.poolTicks[i]! : 0;
      if (color === null || ticks <= 0) {
        hide(m, c, i);
        continue;
      }
      const fade = Math.min(1, ticks / FADE_TICKS);
      const flicker = 0.8 + 0.2 * Math.sin(now * 9 + i * 1.7);
      const r = radius * SCENE_SCALE * (0.6 + 0.4 * fade);
      writeScaled(m, i, h.poolX[i]! * SCENE_SCALE, POOL_LIFT, -h.poolY[i]! * SCENE_SCALE, r, 1, r);
      c[i * 3] = color[0] * flicker * fade;
      c[i * 3 + 1] = color[1] * flicker * fade;
      c[i * 3 + 2] = color[2] * flicker * fade;
      n++;
    }
    this.visible = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    disposeMesh(this.mesh);
  }
}
