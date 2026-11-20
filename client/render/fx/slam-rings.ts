import { CircleGeometry, type InstancedMesh, RingGeometry } from "three/webgpu";
import { createFxMesh, disposeMesh, hide, type Rgb, setColor, writeScaled } from "./instances";

const DEFAULT_POOL = 4;
/** Above the aura rings (0.05) and the blob shadows. */
const FLOOR_LIFT = 0.06;
const RING_INNER = 0.95;
const OUTLINE_OPACITY = 0.9;
const FILL_OPACITY = 0.3;
/** After the hit the whole circle flashes and fades within this time. */
const FLASH_SECONDS = 0.2;
const FLASH_OPACITY = 0.9;

/** Share of the warning circle that is filled: 0 when the warning starts, 1 when the slam lands. */
export function ringFill(elapsedTicks: number, windupTicks: number): number {
  if (windupTicks <= 0) return 1;
  return Math.max(0, Math.min(1, elapsedTicks / windupTicks));
}

/**
 * Warning circles of boss slams on the floor: an outline at the full radius and a disc that grows to it
 * during the windup, then a short flash. A pool of 4 by default; one more slam at once is not drawn.
 */
export class SlamRings {
  readonly outlines: InstancedMesh;
  readonly fills: InstancedMesh;
  /** Circles drawn in the last `write` (warning or flashing). */
  visible = 0;
  /** Enemy slot of the ring; -1 when free. */
  private readonly slot: Int32Array;
  private readonly x: Float64Array;
  private readonly z: Float64Array;
  private readonly radius: Float64Array;
  private readonly start: Float64Array;
  private readonly windup: Float64Array;
  /** Time the flash started; negative while the ring still warns. */
  private readonly flash: Float64Array;
  private readonly pool: number;
  private dirty = false;

  constructor(private readonly color: Rgb, pool = DEFAULT_POOL) {
    this.pool = pool;
    this.slot = new Int32Array(pool).fill(-1);
    this.x = new Float64Array(pool);
    this.z = new Float64Array(pool);
    this.radius = new Float64Array(pool);
    this.start = new Float64Array(pool);
    this.windup = new Float64Array(pool);
    this.flash = new Float64Array(pool).fill(-1);
    this.outlines = createFxMesh(new RingGeometry(RING_INNER, 1, 96).rotateX(-Math.PI / 2), pool);
    this.fills = createFxMesh(new CircleGeometry(1, 64).rotateX(-Math.PI / 2), pool);
  }

  /** A warning starts. Scene coordinates and seconds. */
  warn(slot: number, x: number, z: number, radius: number, now: number, windupSeconds: number): void {
    let i = this.slot.indexOf(slot);
    if (i < 0) i = this.slot.indexOf(-1);
    if (i < 0) return;
    this.slot[i] = slot;
    this.x[i] = x;
    this.z[i] = z;
    this.radius[i] = radius;
    this.start[i] = now;
    this.windup[i] = windupSeconds;
    this.flash[i] = -1;
  }

  /** The slam of `slot` landed: its ring flashes and goes. */
  hit(slot: number, now: number): void {
    const i = this.slot.indexOf(slot);
    if (i >= 0 && this.flash[i]! < 0) this.flash[i] = now;
  }

  /** The slam of `slot` was cancelled: its ring goes at once. */
  cancel(slot: number): void {
    const i = this.slot.indexOf(slot);
    if (i >= 0 && this.flash[i]! < 0) this.slot[i] = -1;
  }

  reset(): void {
    this.slot.fill(-1);
  }

  write(now: number): void {
    const om = this.outlines.instanceMatrix.array as Float32Array;
    const oc = this.outlines.instanceColor!.array as Float32Array;
    const fm = this.fills.instanceMatrix.array as Float32Array;
    const fc = this.fills.instanceColor!.array as Float32Array;
    const [r, g, b] = this.color;
    let visible = 0;
    for (let i = 0; i < this.pool; i++) {
      if (this.slot[i] !== -1 && this.flash[i]! >= 0 && now - this.flash[i]! >= FLASH_SECONDS) this.slot[i] = -1;
      if (this.slot[i] === -1) {
        hide(om, oc, i);
        hide(fm, fc, i);
        continue;
      }
      visible++;
      const radius = this.radius[i]!;
      if (this.flash[i]! >= 0) {
        const fade = 1 - (now - this.flash[i]!) / FLASH_SECONDS;
        hide(om, oc, i);
        writeScaled(fm, i, this.x[i]!, FLOOR_LIFT, this.z[i]!, radius, 1, radius);
        setColor(fc, i, r, g, b, FLASH_OPACITY * Math.max(0, fade));
      } else {
        const fill = radius * ringFill(now - this.start[i]!, this.windup[i]!);
        writeScaled(om, i, this.x[i]!, FLOOR_LIFT, this.z[i]!, radius, 1, radius);
        setColor(oc, i, r, g, b, OUTLINE_OPACITY);
        writeScaled(fm, i, this.x[i]!, FLOOR_LIFT, this.z[i]!, fill, 1, fill);
        setColor(fc, i, r, g, b, FILL_OPACITY);
      }
    }
    // skip the upload while nothing shows and nothing has to be hidden
    if (visible === 0 && !this.dirty) {
      this.visible = 0;
      return;
    }
    this.dirty = visible > 0;
    this.visible = visible;
    this.outlines.instanceMatrix.needsUpdate = true;
    this.outlines.instanceColor!.needsUpdate = true;
    this.fills.instanceMatrix.needsUpdate = true;
    this.fills.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    disposeMesh(this.outlines);
    disposeMesh(this.fills);
  }
}
