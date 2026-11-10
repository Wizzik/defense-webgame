import { Group } from "three/webgpu";
import { AllyKind, EventKind, PROJECTILE_CAPACITY, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { BlastFx } from "./fx/blasts";
import { BoltFx } from "./fx/bolts";
import { Bubbles } from "./fx/bubbles";
import { ProjectileView } from "./fx/projectile-view";
import { RingFx } from "./fx/rings";
import { heroAccent } from "./hero-tints";

const NOVA_COLOR = 0xffd27a;
const ON_CAST_COLOR = 0xc8a165;
const AREA_COLOR = 0x7dff9a;
const CONE_BOLT_COLOR = 0x9fd8ff;
const CONE_BOLT_LIFE = 0.18;
const ATTACK_BOLT_COLOR = 0xfff1b3;
const ATTACK_BOLT_LIFE = 0.1;
const WARD_BOLT_COLOR = 0x1fa38a;
const ALLY_BOLT_LIFE = 0.12;

/** Rings, blasts, bolts, projectiles and bubbles for every ability kind. Events create effects; `update` draws them. */
export class AbilityFx implements RunView {
  readonly object = new Group();
  private readonly rings = new RingFx();
  private readonly blasts = new BlastFx();
  private readonly bolts = new BoltFx();
  private readonly projectiles: ProjectileView;
  private readonly bubbles = new Bubbles();
  private lastRun: Run | null = null;

  constructor() {
    this.projectiles = new ProjectileView(PROJECTILE_CAPACITY);
    this.object.add(...this.rings.meshes, this.blasts.mesh, this.bolts.mesh, this.projectiles.mesh, this.bubbles.object);
  }

  onEvents(run: Run): void {
    this.sync(run);
    const { events } = run;
    const now = run.tick / TICKS_PER_SECOND;
    for (let i = 0; i < events.count; i++) {
      const x = events.x[i]! * SCENE_SCALE;
      const z = -events.y[i]! * SCENE_SCALE;
      switch (events.kind[i]) {
        case EventKind.Cast:
          this.onCast(run, i, now, x, z);
          break;
        case EventKind.Hit:
          this.onHit(run, i, now, x, z);
          break;
        case EventKind.Blast:
          this.blasts.add(now, x, z, 2 * events.value[i]! * SCENE_SCALE);
          break;
        case EventKind.Heal:
          this.rings.addHeal(now, x, z);
          break;
      }
    }
  }

  update(run: Run, alpha: number, dt: number): void {
    this.sync(run);
    const now = (run.tick + alpha) / TICKS_PER_SECOND;
    this.rings.write(now);
    this.blasts.write(now);
    this.bolts.write(now);
    this.projectiles.update(run, alpha, dt);
    this.bubbles.update(run, alpha, now);
  }

  dispose(): void {
    this.object.removeFromParent();
    this.rings.dispose();
    this.blasts.dispose();
    this.bolts.dispose();
    this.projectiles.dispose();
    this.bubbles.dispose();
  }

  /** A new run starts with no effects. */
  private sync(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.rings.reset();
    this.blasts.reset();
    this.bolts.reset();
  }

  private onCast(run: Run, event: number, now: number, x: number, z: number): void {
    const { events } = run;
    const radius = events.value[event]! * SCENE_SCALE;
    switch (run.abilities[events.a[event]!]!.def.kind) {
      case "nova":
        this.rings.addRing(now, x, z, radius, NOVA_COLOR, false);
        break;
      case "on_cast":
        this.rings.addRing(now, x, z, radius, ON_CAST_COLOR, false);
        break;
      case "area":
        this.rings.addRing(now, x, z, radius, AREA_COLOR, true);
        break;
    }
  }

  private onHit(run: Run, event: number, now: number, x: number, z: number): void {
    const { events, hero } = run;
    const source = events.u[event];
    const heroX = hero.x * SCENE_SCALE;
    const heroZ = -hero.y * SCENE_SCALE;
    if (source === 0) {
      if (hero.def.baseAttack.kind !== "melee") {
        this.bolts.add(now, heroX, heroZ, x, z, ATTACK_BOLT_COLOR, ATTACK_BOLT_LIFE);
      }
    } else if (source === 1) {
      if (run.abilities[events.v[event]!]?.def.kind === "cone") {
        this.bolts.add(now, heroX, heroZ, x, z, CONE_BOLT_COLOR, CONE_BOLT_LIFE);
      }
    } else if (source === 2) {
      const ally = events.v[event]!;
      const color = run.allies.kind[ally] === AllyKind.Ward ? WARD_BOLT_COLOR : heroAccent(hero.def.id);
      this.bolts.add(
        now, run.allies.x[ally]! * SCENE_SCALE, -run.allies.y[ally]! * SCENE_SCALE, x, z, color, ALLY_BOLT_LIFE,
      );
    }
  }
}
