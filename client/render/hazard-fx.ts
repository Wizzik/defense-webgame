import { Group, HemisphereLight } from "three/webgpu";
import type { GameData } from "../../data/schema";
import { EventKind, HAZARD_CAPACITY, type Run, TICKS_PER_SECOND, POOL_CAPACITY } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { rgb } from "./fx/instances";
import { PillarFx } from "./fx/pillars";
import { FirePoolFx } from "./fx/fire-pools";
import { SlamRings } from "./fx/slam-rings";
import { lookOf } from "./world-look";

/** Blue-white, apart from the red slam of a boss and the green roots (no orange). */
const BOLT_COLOR = rgb(0xcfe2ff);
/** The bolt's flash is this wide (sim units). */
const BOLT_WIDTH = 46;
const RING_POOL = 8;
/** Meteors: up to bolts.max around each of four heroes; the rings are keyed by the hazard's place. */
const METEOR_RING_POOL = HAZARD_CAPACITY * 4;
const METEOR_WIDTH = 70;
const MAX_PLAYERS = 4;
/** The whole scene lights up for FLASH_SECONDS after a strike (only with screen shake on in Settings). */
const FLASH_SECONDS = 0.15;
const FLASH_INTENSITY = 2.4;

/**
 * The storm (spec 2026-11-21 difficulties 4.7): a blue-white warning circle on the ground while a bolt winds up,
 * then a vertical flash at its centre and a short brightening of the whole scene. The meteors of world 5: a circle and
 * a pillar in the look's fire ring colour (no scene flash), then the pools of fire (`FirePoolFx`).
 */
export class HazardFx implements RunView {
  readonly object = new Group();
  private readonly rings = new SlamRings(BOLT_COLOR, RING_POOL);
  private readonly pillars = new PillarFx(BOLT_COLOR);
  private readonly meteorRings: SlamRings;
  private readonly meteorPillars: PillarFx;
  private readonly pools = new FirePoolFx(POOL_CAPACITY * MAX_PLAYERS);
  private readonly fire: { ring: number; pool: number };
  private readonly poolColor: ReturnType<typeof rgb>;
  private readonly light = new HemisphereLight(0xdce8ff, 0x445066, 0);
  private flashAt = -1;
  private lastRun: Run | null = null;

  /** `flashes()` says whether the scene may light up (screen shake in Settings). */
  constructor(private readonly data: GameData, private readonly flashes: () => boolean) {
    this.fire = this.data.worlds.map((w) => lookOf(w.id).fire).find((f) => f !== null) ?? { ring: 0x9cff6a, pool: 0x5ce03a };
    this.meteorRings = new SlamRings(rgb(this.fire.ring), METEOR_RING_POOL);
    this.meteorPillars = new PillarFx(rgb(this.fire.ring));
    this.poolColor = rgb(this.fire.pool);
    this.object.add(
      this.rings.outlines, this.rings.fills, this.pillars.mesh, this.light,
      this.meteorRings.outlines, this.meteorRings.fills, this.meteorPillars.mesh, this.pools.mesh,
    );
  }

  /** Warning circles on the floor now. */
  get ringCount(): number {
    return this.rings.visible + this.meteorRings.visible;
  }

  /** Pools of fire drawn now. */
  get poolCount(): number {
    return this.pools.visible;
  }

  onEvents(run: Run): void {
    this.sync(run);
    const { events } = run;
    const now = run.tick / TICKS_PER_SECOND;
    const meteors = this.isMeteors(run);
    const rings = meteors ? this.meteorRings : this.rings;
    for (let i = 0; i < events.count; i++) {
      if (events.kind[i] !== EventKind.Hazard) continue;
      const a = events.a[i]!;
      const x = events.x[i]! * SCENE_SCALE;
      const z = -events.y[i]! * SCENE_SCALE;
      if (events.value[i] === 0) {
        rings.warn(a, x, z, events.u[i]! * SCENE_SCALE, now, events.v[i]! / TICKS_PER_SECOND);
      } else if (events.value[i] === 1) {
        rings.hit(a, now);
        if (meteors) {
          this.meteorPillars.add(now, x, z, METEOR_WIDTH * SCENE_SCALE);
        } else {
          this.pillars.add(now, x, z, BOLT_WIDTH * SCENE_SCALE);
          this.flashAt = now;
        }
      }
    }
  }

  update(run: Run, alpha: number): void {
    this.sync(run);
    const now = (run.tick + alpha) / TICKS_PER_SECOND;
    this.rings.write(now);
    this.pillars.write(now);
    this.meteorRings.write(now);
    this.meteorPillars.write(now);
    const hazard = this.data.worlds[run.world - 1]!.hazard;
    this.pools.write(run, hazard.kind === "meteors" ? this.poolColor : null, hazard.kind === "meteors" ? hazard.pool.radius : 0, now);
    const age = now - this.flashAt;
    this.light.intensity = this.flashAt >= 0 && age < FLASH_SECONDS && this.flashes()
      ? FLASH_INTENSITY * (1 - age / FLASH_SECONDS)
      : 0;
  }

  dispose(): void {
    this.object.removeFromParent();
    this.rings.dispose();
    this.pillars.dispose();
    this.meteorRings.dispose();
    this.meteorPillars.dispose();
    this.pools.dispose();
  }

  private isMeteors(run: Run): boolean {
    return this.data.worlds[run.world - 1]!.hazard.kind === "meteors";
  }

  /** A new run starts with no circles. */
  private sync(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.rings.reset();
    this.pillars.reset();
    this.meteorRings.reset();
    this.meteorPillars.reset();
    this.flashAt = -1;
  }
}
