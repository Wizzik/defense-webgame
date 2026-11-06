import type { GameData } from "../data/schema";
import { TICKS_PER_SECOND } from "./constants";
import { EnemyStore } from "./enemies";
import { EventKind, EventLog } from "./events";
import { heroStats, moveHero } from "./hero";
import type { TickInput } from "./input";
import { Rng } from "./rng";
import type { CastleState, HeroState, HeroStats, RunStats } from "./world";

export type RunState = "playing" | "levelUp" | "won" | "lost";
export type RunResult = "won" | "castle" | "hero";
export interface RunOptions {
  seed: number;
  durationSeconds?: number;
}

const EVENT_CAPACITY = 1024;

export class Run {
  readonly data: GameData;
  readonly rng: Rng;
  readonly events = new EventLog(EVENT_CAPACITY);
  readonly hero: HeroState;
  readonly castle: CastleState;
  readonly enemies: EnemyStore;
  readonly stats: RunStats = { kills: 0, damageDealt: 0 };
  readonly durationTicks: number;
  tick = 0;
  state: RunState = "playing";
  result: RunResult | null = null;

  constructor(data: GameData, options: RunOptions) {
    const { rules } = data;
    this.data = data;
    this.rng = new Rng(options.seed);
    this.enemies = new EnemyStore(rules.enemies.maxAlive);
    this.durationTicks = Math.round(
      (options.durationSeconds ?? rules.run.durationSeconds) * TICKS_PER_SECOND,
    );

    const def = data.heroes.find((h) => h.id === rules.slice.hero);
    if (!def) throw new Error(`createRun: unknown hero "${rules.slice.hero}"`);
    const stats: HeroStats = {
      maxHp: 0, regenPerSecond: 0, armor: 0, attackIntervalSeconds: 0, damageMin: 0, damageMax: 0,
      spellPower: 0, cooldownScale: 0, moveSpeed: 0, collision: 0,
    };
    const start = rules.arena.heroStart;
    const hero: HeroState = {
      def, x: start.x, y: start.y, prevX: start.x, prevY: start.y,
      facingX: 0, facingY: 1, moving: false,
      level: 1, xp: 0,
      str: def.attributes.str.base, agi: def.attributes.agi.base, int: def.attributes.int.base,
      hp: 0, stats, attackCooldown: 0, pendingLevelUps: 0,
    };
    heroStats(data, hero, stats);
    hero.hp = stats.maxHp;
    this.hero = hero;

    this.castle = {
      x: rules.arena.castle.x, y: rules.arena.castle.y, radius: rules.castle.radius,
      hp: rules.castle.hp, maxHp: rules.castle.hp, lastHitTick: -1,
    };
  }

  get timeSeconds(): number {
    return this.tick / TICKS_PER_SECOND;
  }

  get phaseIndex(): number {
    const { run, phases } = this.data.rules;
    return Math.min(Math.floor(this.tick / (run.phaseSeconds * TICKS_PER_SECOND)), phases.length - 1);
  }

  /**
   * Advances one fixed step. Systems run in this order; each task adds its line in place:
   *
   *   if (state === "won" || state === "lost") return;
   *   events.clear();
   *   if (state === "levelUp") { chooseCard(this, input.card); return; }   // Task 7; time stands still
   *   savePrevious(this);         // Task 3 (crystals: Task 7)
   *   moveHero(this, input);      // Task 3
   *   spawnEnemies(this);         // Task 4
   *   updateEnemies(this);        // Task 4
   *   updateHeroCombat(this);     // Task 5
   *   updateAbilities(this);      // Task 6
   *   updateCrystals(this);       // Task 7
   *   regenCastle(this);          // Task 4
   *   this.tick++;
   *   checkEnd(this);             // castle (Task 4) -> hero (Task 5) -> time (Task 3); a loss wins over a win
   *   if (state === "playing" && hero.pendingLevelUps > 0) openOffer(this);   // Task 7
   */
  step(input: TickInput): void {
    if (this.state === "won" || this.state === "lost") return;
    this.events.clear();
    savePrevious(this);
    moveHero(this, input);
    this.tick++;
    checkEnd(this);
  }
}

function savePrevious(run: Run): void {
  const { hero, enemies } = run;
  hero.prevX = hero.x;
  hero.prevY = hero.y;
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0) continue;
    enemies.prevX[i] = enemies.x[i];
    enemies.prevY[i] = enemies.y[i];
  }
}

function checkEnd(run: Run): void {
  if (run.tick >= run.durationTicks) {
    run.state = "won";
    run.result = "won";
    run.events.push(EventKind.RunEnd, 0, 0, 0, 0, 0, 0);
  }
}

export function createRun(data: GameData, options: RunOptions): Run {
  return new Run(data, options);
}
