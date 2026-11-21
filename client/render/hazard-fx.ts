import { Group, HemisphereLight } from "three/webgpu";
import { EventKind, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { rgb } from "./fx/instances";
import { PillarFx } from "./fx/pillars";
import { SlamRings } from "./fx/slam-rings";

/** Blue-white, apart from the red slam of a boss and the green roots (no orange). */
const BOLT_COLOR = rgb(0xcfe2ff);
/** The bolt's flash is this wide (sim units). */
const BOLT_WIDTH = 46;
const RING_POOL = 8;
/** The whole scene lights up for FLASH_SECONDS after a strike (only with screen shake on in Settings). */
const FLASH_SECONDS = 0.15;
const FLASH_INTENSITY = 2.4;

/**
 * The storm (spec 2026-11-21 difficulties 4.7): a blue-white warning circle on the ground while a bolt winds up,
 * then a vertical flash at its centre and a short brightening of the whole scene.
 */
export class HazardFx implements RunView {
  readonly object = new Group();
  private readonly rings = new SlamRings(BOLT_COLOR, RING_POOL);
  private readonly pillars = new PillarFx(BOLT_COLOR);
  private readonly light = new HemisphereLight(0xdce8ff, 0x445066, 0);
  private flashAt = -1;
  private lastRun: Run | null = null;

  /** `flashes()` says whether the scene may light up (screen shake in Settings). */
  constructor(private readonly flashes: () => boolean) {
    this.object.add(this.rings.outlines, this.rings.fills, this.pillars.mesh, this.light);
  }

  /** Warning circles on the floor now. */
  get ringCount(): number {
    return this.rings.visible;
  }

  onEvents(run: Run): void {
    this.sync(run);
    const { events } = run;
    const now = run.tick / TICKS_PER_SECOND;
    for (let i = 0; i < events.count; i++) {
      if (events.kind[i] !== EventKind.Hazard) continue;
      const a = events.a[i]!;
      const x = events.x[i]! * SCENE_SCALE;
      const z = -events.y[i]! * SCENE_SCALE;
      if (events.value[i] === 0) {
        this.rings.warn(a, x, z, events.u[i]! * SCENE_SCALE, now, events.v[i]! / TICKS_PER_SECOND);
      } else {
        this.rings.hit(a, now);
        this.pillars.add(now, x, z, BOLT_WIDTH * SCENE_SCALE);
        this.flashAt = now;
      }
    }
  }

  update(run: Run, alpha: number): void {
    this.sync(run);
    const now = (run.tick + alpha) / TICKS_PER_SECOND;
    this.rings.write(now);
    this.pillars.write(now);
    const age = now - this.flashAt;
    this.light.intensity = this.flashAt >= 0 && age < FLASH_SECONDS && this.flashes()
      ? FLASH_INTENSITY * (1 - age / FLASH_SECONDS)
      : 0;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.rings.dispose();
    this.pillars.dispose();
  }

  /** A new run starts with no circles. */
  private sync(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.rings.reset();
    this.pillars.reset();
    this.flashAt = -1;
  }
}
