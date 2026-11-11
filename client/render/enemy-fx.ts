import { Group } from "three/webgpu";
import type { GameData } from "../../data/schema";
import { EventKind, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { AuraRings } from "./fx/aura-rings";
import { BoltFx } from "./fx/bolts";
import { rgb } from "./fx/instances";

const SHOT_COLOR = rgb(0xfff2b0);
const SHOT_LIFE = 0.12;
const HEAL_COLOR = rgb(0x7dff9a);
const HEAL_LIFE = 0.18;
/** Charge telegraph: a line from the lancer along its charge, for the windup. */
const CHARGE_COLOR = rgb(0xff5a5a);
const CHARGE_THICKNESS = 0.18;
const AURA_COLOR = rgb(0xb84ad8);
const AURA_OPACITY = 0.25;

/**
 * Shots of ranged enemies (the hit is instant, the beam is only an effect) and the heal beams of
 * chaplains, the line that warns of a lancer's charge and the ring under a captain's aura. A shooter that died in the same step is drawn from its last position: its slot keeps
 * the values until the next spawn, which comes only in the next step.
 */
export class EnemyFx implements RunView {
  readonly object = new Group();
  private readonly bolts = new BoltFx();
  private readonly telegraphs: BoltFx;
  private readonly auraRings = new AuraRings();
  private readonly data: GameData;
  /** 1 for enemy types that shoot. */
  private readonly ranged: Uint8Array;
  private lastRun: Run | null = null;

  constructor(data: GameData) {
    this.ranged = Uint8Array.from(data.enemies, (e) => (e.attack.kind === "ranged" ? 1 : 0));
    this.data = data;
    const windup = Math.max(0.1, ...data.enemies.map((e) => e.charge?.windupSeconds ?? 0));
    this.telegraphs = new BoltFx(windup, CHARGE_THICKNESS);
    this.object.add(this.bolts.mesh, this.telegraphs.mesh, this.auraRings.mesh);
  }

  onEvents(run: Run): void {
    this.sync(run);
    const { events, enemies: e, castle } = run;
    const now = run.tick / TICKS_PER_SECOND;
    for (let i = 0; i < events.count; i++) {
      const kind = events.kind[i];
      const a = events.a[i]!;
      if (kind === EventKind.HeroHit) {
        // the event carries the hero's position
        if (a < 0 || this.ranged[e.type[a]!] !== 1) continue;
        this.beam(now, e.x[a]!, e.y[a]!, events.x[i]!, events.y[i]!, true);
      } else if (kind === EventKind.CastleHit) {
        // the event carries the attacker's position
        if (a < 0 || this.ranged[e.type[a]!] !== 1) continue;
        this.beam(now, events.x[i]!, events.y[i]!, castle.x, castle.y, true);
      } else if (kind === EventKind.EnemyHeal) {
        const healer = events.u[i]!;
        // a chaplain healing itself has no beam (zero length)
        this.beam(now, e.x[healer]!, e.y[healer]!, events.x[i]!, events.y[i]!, false);
      } else if (kind === EventKind.EnemyCharge && events.value[i] === 0) {
        const charge = this.data.enemies[e.type[a]!]!.charge;
        if (charge === undefined) continue;
        const x = events.x[i]!;
        const y = events.y[i]!;
        this.telegraphs.add(
          now, x * SCENE_SCALE, -y * SCENE_SCALE,
          (x + events.u[i]! * charge.distance) * SCENE_SCALE, -(y + events.v[i]! * charge.distance) * SCENE_SCALE,
          CHARGE_COLOR, charge.windupSeconds,
        );
      }
    }
  }

  update(run: Run, alpha: number, _dt: number): void {
    this.sync(run);
    const now = (run.tick + alpha) / TICKS_PER_SECOND;
    this.bolts.write(now);
    this.telegraphs.write(now);
    this.auraRings.begin();
    const auraType = run.auraType;
    if (auraType >= 0) {
      const radius = this.data.enemies[auraType]!.aura!.radius * SCENE_SCALE;
      const e = run.enemies;
      for (let i = 0; i < e.capacity; i++) {
        if (e.alive[i] === 0 || e.type[i] !== auraType) continue;
        const x = e.prevX[i]! + (e.x[i]! - e.prevX[i]!) * alpha;
        const y = e.prevY[i]! + (e.y[i]! - e.prevY[i]!) * alpha;
        this.auraRings.add(x * SCENE_SCALE, -y * SCENE_SCALE, radius, AURA_COLOR, AURA_OPACITY);
      }
    }
    this.auraRings.end();
  }

  dispose(): void {
    this.object.removeFromParent();
    this.bolts.dispose();
    this.telegraphs.dispose();
    this.auraRings.dispose();
  }

  private beam(now: number, ax: number, ay: number, bx: number, by: number, shot: boolean): void {
    this.bolts.add(
      now, ax * SCENE_SCALE, -ay * SCENE_SCALE, bx * SCENE_SCALE, -by * SCENE_SCALE,
      shot ? SHOT_COLOR : HEAL_COLOR, shot ? SHOT_LIFE : HEAL_LIFE,
    );
  }

  /** A new run starts with no effects. */
  private sync(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.bolts.reset();
    this.telegraphs.reset();
  }
}
