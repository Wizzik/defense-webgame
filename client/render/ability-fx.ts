import { eventOwner } from "./event-owner";
import { Group } from "three/webgpu";
import { AllyKind, EventKind, PROJECTILE_CAPACITY, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { BlastFx } from "./fx/blasts";
import { BoltFx } from "./fx/bolts";
import { Bubbles } from "./fx/bubbles";
import { ProjectileView } from "./fx/projectile-view";
import { type Rgb, rgb } from "./fx/instances";
import { PillarFx } from "./fx/pillars";
import { RingFx } from "./fx/rings";
import { heroAccent } from "./hero-tints";

const NOVA_COLOR = rgb(0xffd27a);
const ON_CAST_COLOR = rgb(0xc8a165);
const AREA_COLOR = rgb(0x7dff9a);
const CONE_BOLT_COLOR = rgb(0x9fd8ff);
const CONE_BOLT_LIFE = 0.18;
const ATTACK_BOLT_COLOR = rgb(0xfff1b3);
const ATTACK_BOLT_LIFE = 0.1;
const WARD_BOLT_COLOR = rgb(0x7fffe6);
const ALLY_BOLT_LIFE = 0.18;
const CHAIN_BOLT_COLOR = rgb(0x8fc7ff);
const CHAIN_BOLT_LIFE = 0.18;
const SMITE_COLOR = rgb(0xd6e6ff);
const BLINK_STREAK_LIFE = 0.25;
/** Width of the strike from above, in scene units. */
const SMITE_WIDTH = 0.7;

/** Rings, blasts, bolts, projectiles and bubbles for every ability kind. Events create effects; `update` draws them. */
export class AbilityFx implements RunView {
  readonly object = new Group();
  private readonly rings = new RingFx();
  private readonly blasts = new BlastFx();
  private readonly bolts = new BoltFx();
  private readonly projectiles: ProjectileView;
  private readonly bubbles = new Bubbles();
  private readonly pillars = new PillarFx(SMITE_COLOR);
  /** Per slot: where the bolt of a chain spell stands now (scene x, z); a Cast puts it on the hero. */
  private readonly chainX: number[] = [];
  private readonly chainZ: number[] = [];
  private lastRun: Run | null = null;
  /** The hero's effect colour, computed when the run changes. */
  private heroColor: Rgb = rgb(0);

  constructor() {
    this.projectiles = new ProjectileView(PROJECTILE_CAPACITY);
    this.object.add(
      ...this.rings.meshes, this.blasts.mesh, this.bolts.mesh, this.projectiles.mesh, this.bubbles.object, this.pillars.mesh,
    );
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
          this.onBlast(run, i, now, x, z);
          break;
        case EventKind.Heal:
          this.rings.addHeal(now, x, z);
          break;
        case EventKind.Blink: {
          // a streak from where the hero left to where he landed, a burst and a ring of the hero's colour there
          const lx = events.u[i]! * SCENE_SCALE;
          const lz = -events.v[i]! * SCENE_SCALE;
          const radius = events.value[i]! * SCENE_SCALE;
          this.bolts.add(now, x, z, lx, lz, this.heroColor, BLINK_STREAK_LIFE);
          this.blasts.add(now, lx, lz, 2 * radius);
          this.rings.addRing(now, lx, lz, radius, this.heroColor, false);
          break;
        }
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
    this.pillars.write(now);
  }

  dispose(): void {
    this.object.removeFromParent();
    this.rings.dispose();
    this.blasts.dispose();
    this.bolts.dispose();
    this.projectiles.dispose();
    this.bubbles.dispose();
    this.pillars.dispose();
  }

  /** A new run starts with no effects. */
  private sync(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.heroColor = rgb(heroAccent(run.hero.def.id));
    this.rings.reset();
    this.blasts.reset();
    this.bolts.reset();
    this.pillars.reset();
  }

  /** A chain leaps from the last point of its bolt; an instant strikes from above; any other blast pops. */
  private onBlast(run: Run, event: number, now: number, x: number, z: number): void {
    const slot = run.events.a[event]!;
    const kind = slot >= 0 ? eventOwner(run, event).abilities[slot]?.def.kind : undefined;
    if (kind === "chain") {
      this.bolts.add(now, this.chainX[slot] ?? x, this.chainZ[slot] ?? z, x, z, CHAIN_BOLT_COLOR, CHAIN_BOLT_LIFE);
      this.chainX[slot] = x;
      this.chainZ[slot] = z;
    } else if (kind === "instant") {
      this.pillars.add(now, x, z, SMITE_WIDTH);
    } else {
      this.blasts.add(now, x, z, 2 * run.events.value[event]! * SCENE_SCALE);
    }
  }

  private onCast(run: Run, event: number, now: number, x: number, z: number): void {
    const { events } = run;
    const radius = events.value[event]! * SCENE_SCALE;
    switch (eventOwner(run, event).abilities[events.a[event]!]!.def.kind) {
      case "nova":
        this.rings.addRing(now, x, z, radius, NOVA_COLOR, false);
        break;
      case "on_cast":
        this.rings.addRing(now, x, z, radius, ON_CAST_COLOR, false);
        break;
      case "area":
        this.rings.addRing(now, x, z, radius, AREA_COLOR, true);
        break;
      case "chain": {
        const slot = events.a[event]!;
        this.chainX[slot] = x;
        this.chainZ[slot] = z;
        break;
      }
    }
  }

  private onHit(run: Run, event: number, now: number, x: number, z: number): void {
    const { events } = run;
    const { hero, abilities } = eventOwner(run, event);
    const source = events.u[event];
    const heroX = hero.x * SCENE_SCALE;
    const heroZ = -hero.y * SCENE_SCALE;
    if (source === 0) {
      if (hero.def.baseAttack.kind !== "melee") {
        this.bolts.add(now, heroX, heroZ, x, z, ATTACK_BOLT_COLOR, ATTACK_BOLT_LIFE);
      }
    } else if (source === 1) {
      if (abilities[events.v[event]!]?.def.kind === "cone") {
        this.bolts.add(now, heroX, heroZ, x, z, CONE_BOLT_COLOR, CONE_BOLT_LIFE);
      }
    } else if (source === 2) {
      const ally = events.v[event]!;
      const color = run.allies.kind[ally] === AllyKind.Ward ? WARD_BOLT_COLOR : this.heroColor;
      this.bolts.add(
        now, run.allies.x[ally]! * SCENE_SCALE, -run.allies.y[ally]! * SCENE_SCALE, x, z, color, ALLY_BOLT_LIFE,
      );
    }
  }
}
