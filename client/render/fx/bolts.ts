import { BoxGeometry, type InstancedMesh } from "three/webgpu";
import { createFxMesh, disposeMesh, hide, setColor, writeBeam, rgb } from "./instances";
import { FxPool } from "./pool";

const BOLT_POOL = 96;
/** The longest life of any bolt; each bolt keeps its own, shorter, one. */
const BOLT_MAX_LIFE = 0.18;
const BOLT_THICKNESS = 0.06;
/** Height of both ends above the floor, in scene units. */
const BOLT_HEIGHT = 0.6;

/** Thin beams from point A to point B that fade out: cone hits, ranged attacks, ally attacks. */
export class BoltFx {
  readonly mesh: InstancedMesh;
  private readonly pool = new FxPool(BOLT_POOL, BOLT_MAX_LIFE);
  private readonly ax = new Float32Array(BOLT_POOL);
  private readonly az = new Float32Array(BOLT_POOL);
  private readonly bx = new Float32Array(BOLT_POOL);
  private readonly bz = new Float32Array(BOLT_POOL);
  private readonly life = new Float32Array(BOLT_POOL);
  private readonly color = new Float32Array(BOLT_POOL * 3);

  constructor() {
    this.mesh = createFxMesh(new BoxGeometry(1, 1, 1), BOLT_POOL);
  }

  /** Scene coordinates; `life` in seconds (at most 0.18). */
  add(now: number, ax: number, az: number, bx: number, bz: number, hex: number, life: number): void {
    const i = this.pool.add(now);
    this.ax[i] = ax;
    this.az[i] = az;
    this.bx[i] = bx;
    this.bz[i] = bz;
    this.life[i] = life;
    const [r, g, b] = rgb(hex);
    this.color[i * 3] = r;
    this.color[i * 3 + 1] = g;
    this.color[i * 3 + 2] = b;
  }

  write(now: number): void {
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const c = this.mesh.instanceColor!.array as Float32Array;
    for (let i = 0; i < BOLT_POOL; i++) {
      const age = this.pool.age(i, now);
      const life = this.life[i]!;
      if (
        age < 0 || age > life
        || !writeBeam(m, i, this.ax[i]!, this.az[i]!, this.bx[i]!, this.bz[i]!, BOLT_HEIGHT, BOLT_THICKNESS)
      ) {
        hide(m, c, i);
        continue;
      }
      setColor(c, i, this.color[i * 3]!, this.color[i * 3 + 1]!, this.color[i * 3 + 2]!, 1 - age / life);
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
