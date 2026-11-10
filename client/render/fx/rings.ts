import { CircleGeometry, type InstancedMesh, RingGeometry } from "three/webgpu";
import { createFxMesh, disposeMesh, hide, type Rgb, rgb, setColor, writeScaled } from "./instances";
import { FxPool } from "./pool";

const RING_POOL = 64;
const RING_LIFE = 0.4;
/** The ring expands for this long, then fades for the rest of its life. */
const RING_GROW = 0.25;
const DISC_OPACITY = 0.3;
const HEAL_POOL = 16;
const HEAL_LIFE = 0.5;
const HEAL_RISE = 0.5;
/** Radius of the heal ring in scene units. */
const HEAL_RADIUS = 1;
const HEAL_COLOR = 0x6dff8a;
/** Ring and disc lie just above the floor. */
const FLOOR_LIFT = 0.04;
/** Inner radius of a unit ring. */
const RING_INNER = 0.9;

/** Expanding rings on the floor (nova, on_cast, area; the area also gets a disc) and rising heal rings. */
export class RingFx {
  readonly meshes: InstancedMesh[];
  private readonly rings: InstancedMesh;
  private readonly discs: InstancedMesh;
  private readonly heals: InstancedMesh;
  private readonly pool = new FxPool(RING_POOL, RING_LIFE);
  private readonly healPool = new FxPool(HEAL_POOL, HEAL_LIFE);
  private readonly x = new Float32Array(RING_POOL);
  private readonly z = new Float32Array(RING_POOL);
  private readonly radius = new Float32Array(RING_POOL);
  private readonly color = new Float32Array(RING_POOL * 3);
  private readonly disc = new Uint8Array(RING_POOL);
  private readonly healX = new Float32Array(HEAL_POOL);
  private readonly healZ = new Float32Array(HEAL_POOL);
  private readonly healRgb = rgb(HEAL_COLOR);

  constructor() {
    const flat = (geometry: RingGeometry | CircleGeometry): typeof geometry => geometry.rotateX(-Math.PI / 2);
    this.rings = createFxMesh(flat(new RingGeometry(RING_INNER, 1, 48)), RING_POOL);
    this.discs = createFxMesh(flat(new CircleGeometry(1, 48)), RING_POOL);
    this.heals = createFxMesh(flat(new RingGeometry(RING_INNER, 1, 32)), HEAL_POOL);
    this.meshes = [this.discs, this.rings, this.heals];
  }

  /** A ring at (x, z) in scene units that expands to `radius`; `color` is precomputed (no allocation here). */
  addRing(now: number, x: number, z: number, radius: number, color: Rgb, disc: boolean): void {
    const i = this.pool.add(now);
    this.x[i] = x;
    this.z[i] = z;
    this.radius[i] = radius;
    this.color[i * 3] = color[0];
    this.color[i * 3 + 1] = color[1];
    this.color[i * 3 + 2] = color[2];
    this.disc[i] = disc ? 1 : 0;
  }

  addHeal(now: number, x: number, z: number): void {
    const i = this.healPool.add(now);
    this.healX[i] = x;
    this.healZ[i] = z;
  }

  write(now: number): void {
    const rm = this.rings.instanceMatrix.array as Float32Array;
    const rc = this.rings.instanceColor!.array as Float32Array;
    const dm = this.discs.instanceMatrix.array as Float32Array;
    const dc = this.discs.instanceColor!.array as Float32Array;
    for (let i = 0; i < RING_POOL; i++) {
      const age = this.pool.age(i, now);
      if (age < 0) {
        hide(rm, rc, i);
        hide(dm, dc, i);
        continue;
      }
      const radius = this.radius[i]! * Math.min(1, age / RING_GROW);
      const fade = age <= RING_GROW ? 1 : (RING_LIFE - age) / (RING_LIFE - RING_GROW);
      const r = this.color[i * 3]!;
      const g = this.color[i * 3 + 1]!;
      const b = this.color[i * 3 + 2]!;
      writeScaled(rm, i, this.x[i]!, FLOOR_LIFT, this.z[i]!, radius, 1, radius);
      setColor(rc, i, r, g, b, fade);
      if (this.disc[i] === 1) {
        writeScaled(dm, i, this.x[i]!, FLOOR_LIFT * 0.5, this.z[i]!, radius, 1, radius);
        setColor(dc, i, r, g, b, fade * DISC_OPACITY);
      } else {
        hide(dm, dc, i);
      }
    }
    const hm = this.heals.instanceMatrix.array as Float32Array;
    const hc = this.heals.instanceColor!.array as Float32Array;
    const [hr, hg, hb] = this.healRgb;
    for (let i = 0; i < HEAL_POOL; i++) {
      const age = this.healPool.age(i, now);
      if (age < 0) {
        hide(hm, hc, i);
        continue;
      }
      const t = age / HEAL_LIFE;
      writeScaled(hm, i, this.healX[i]!, FLOOR_LIFT + HEAL_RISE * t, this.healZ[i]!, HEAL_RADIUS, 1, HEAL_RADIUS);
      setColor(hc, i, hr, hg, hb, 1 - t);
    }
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    }
  }

  reset(): void {
    this.pool.reset();
    this.healPool.reset();
  }

  dispose(): void {
    for (const mesh of this.meshes) disposeMesh(mesh);
  }
}
