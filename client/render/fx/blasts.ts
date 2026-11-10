import { type InstancedMesh, SphereGeometry } from "three/webgpu";
import { createFxMesh, disposeMesh, hide, rgb, setColor, writeScaled } from "./instances";
import { FxPool } from "./pool";

const BLAST_POOL = 128;
const BLAST_LIFE = 0.3;
const BLAST_COLOR = 0xff7a3d;
/** Peak brightness of the pop, the same as an enemy's death pop. */
const BLAST_BRIGHTNESS = 0.6;

/** Pop spheres where a blast hits; the diameter is the blast's hit diameter. */
export class BlastFx {
  readonly mesh: InstancedMesh;
  private readonly pool = new FxPool(BLAST_POOL, BLAST_LIFE);
  private readonly x = new Float32Array(BLAST_POOL);
  private readonly z = new Float32Array(BLAST_POOL);
  private readonly size = new Float32Array(BLAST_POOL);
  private readonly color = rgb(BLAST_COLOR);

  constructor() {
    this.mesh = createFxMesh(new SphereGeometry(0.5, 12, 8), BLAST_POOL);
  }

  /** `diameter` in scene units. */
  add(now: number, x: number, z: number, diameter: number): void {
    const i = this.pool.add(now);
    this.x[i] = x;
    this.z[i] = z;
    this.size[i] = diameter;
  }

  write(now: number): void {
    const m = this.mesh.instanceMatrix.array as Float32Array;
    const c = this.mesh.instanceColor!.array as Float32Array;
    const [r, g, b] = this.color;
    for (let i = 0; i < BLAST_POOL; i++) {
      const age = this.pool.age(i, now);
      if (age < 0) {
        hide(m, c, i);
        continue;
      }
      const t = age / BLAST_LIFE;
      const size = this.size[i]! * t;
      writeScaled(m, i, this.x[i]!, size * 0.5, this.z[i]!, size, size, size);
      setColor(c, i, r!, g!, b!, (1 - t) * BLAST_BRIGHTNESS);
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
