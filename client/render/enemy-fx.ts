import { Group } from "three/webgpu";
import type { GameData } from "../../data/schema";
import { EventKind, type Run, TICKS_PER_SECOND } from "../../sim";
import type { RunView } from "../game/session";
import { SCENE_SCALE } from "./coords";
import { BoltFx } from "./fx/bolts";
import { rgb } from "./fx/instances";

const SHOT_COLOR = rgb(0xfff2b0);
const SHOT_LIFE = 0.12;
const HEAL_COLOR = rgb(0x7dff9a);
const HEAL_LIFE = 0.18;

/**
 * Shots of ranged enemies (the hit is instant, the beam is only an effect) and the heal beams of
 * chaplains. A shooter that died in the same step is drawn from its last position: its slot keeps
 * the values until the next spawn, which comes only in the next step.
 */
export class EnemyFx implements RunView {
  readonly object = new Group();
  private readonly bolts = new BoltFx();
  /** 1 for enemy types that shoot. */
  private readonly ranged: Uint8Array;
  private lastRun: Run | null = null;

  constructor(data: GameData) {
    this.ranged = Uint8Array.from(data.enemies, (e) => (e.attack.kind === "ranged" ? 1 : 0));
    this.object.add(this.bolts.mesh);
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
      }
    }
  }

  update(run: Run, alpha: number, _dt: number): void {
    this.sync(run);
    this.bolts.write((run.tick + alpha) / TICKS_PER_SECOND);
  }

  dispose(): void {
    this.object.removeFromParent();
    this.bolts.dispose();
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
  }
}
