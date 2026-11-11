import type { GameData } from "../data/schema";
import { createAbilitySlots, updateAbilities } from "./abilities/slots";
import type { AbilitySlot } from "./abilities/slots";
import { TICKS_PER_SECOND } from "./constants";
import { chooseCard, openOffer } from "./cards";
import type { CardOffer } from "./cards";
import { regenCastle } from "./castle";
import { ALLY_CAPACITY, AllyStore, updateAllies } from "./allies";
import { PROJECTILE_CAPACITY, ProjectileStore, updateProjectiles } from "./projectiles";
import { CRYSTAL_CAPACITY, CrystalStore, updateCrystals } from "./crystals";
import { updateEnemies } from "./enemy-ai";
import { healEnemies } from "./enemy-heal";
import { EnemyStore } from "./enemies";
import { EventKind, EventLog } from "./events";
import { refreshHeroStats } from "./level-up";
import { applyActions, heroStats, moveHero, updateHeroCombat } from "./hero";
import type { TickInput } from "./input";
import { Rng } from "./rng";
import { spawnEnemies } from "./spawner";
import { buildPhaseTables, enemyType, type PhaseTable } from "./spawn-tables";
import { SpatialHash } from "./spatial-grid";
import type { CastleState, HeroState, HeroStats, RunStats } from "./world";

export type RunState = "playing" | "levelUp" | "won" | "lost";
export type RunResult = "won" | "castle" | "hero";
export interface RunOptions {
  seed: number;
  durationSeconds?: number;
  /** Hero id; defaults to rules.start.hero. */
  hero?: string;
}

const EVENT_CAPACITY = 1024;

export class Run {
  readonly data: GameData;
  readonly rng: Rng;
  readonly events = new EventLog(EVENT_CAPACITY);
  readonly hero: HeroState;
  readonly castle: CastleState;
  readonly enemies: EnemyStore;
  readonly grid: SpatialHash;
  readonly heroIndex: number;
  readonly abilities: AbilitySlot[];
  readonly crystals = new CrystalStore(CRYSTAL_CAPACITY);
  readonly projectiles = new ProjectileStore(PROJECTILE_CAPACITY);
  readonly allies = new AllyStore(ALLY_CAPACITY);
  offer: CardOffer | null = null;
  /** Weighted enemy types per phase, built once here so a step does not allocate. */
  readonly phaseTables: PhaseTable[];
  /** Type index of the elite. */
  readonly eliteType: number;
  /** The step in which the next pack comes. */
  nextPackTick: number;
  /** The last phase whose elites were sent (-1: none yet). */
  elitePhase = -1;
  readonly stats: RunStats = { kills: 0, spawned: 0, damageDealt: 0 };
  readonly durationTicks: number;
  /** The ultimate casts by itself; the player can switch this off (Task 7). */
  ultimateAuto = true;
  /** R was pressed in this step; cleared by updateAbilities. */
  ultimateRequested = false;
  /** Steps left of the spirit shield: hero and castle take no damage while > 0. */
  shieldTicks = 0;
  tick = 0;
  state: RunState = "playing";
  result: RunResult | null = null;

  constructor(data: GameData, options: RunOptions) {
    const { rules } = data;
    this.data = data;
    this.rng = new Rng(options.seed);
    this.enemies = new EnemyStore(rules.enemies.maxAlive);
    this.grid = new SpatialHash(128, rules.enemies.maxAlive);
    this.phaseTables = buildPhaseTables(data);
    this.eliteType = enemyType(data, rules.enemies.elite, "rules.enemies.elite");
    this.nextPackTick = Math.round(rules.run.firstPackSeconds * TICKS_PER_SECOND);
    this.durationTicks = Math.round(
      (options.durationSeconds ?? rules.run.durationSeconds) * TICKS_PER_SECOND,
    );

    const heroId = options.hero ?? rules.start.hero;
    const heroIndex = data.heroes.findIndex((h) => h.id === heroId);
    if (heroIndex < 0) throw new Error(`createRun: unknown hero "${heroId}"`);
    const def = data.heroes[heroIndex];
    this.heroIndex = heroIndex;
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
      hp: 0, stats, bonus: { damage: 0, moveSpeed: 0, attackSpeed: 0 }, attackCooldown: 0, pendingLevelUps: 0,
      dashTicks: 0, dashCooldown: 0, dashDirX: 0, dashDirY: 0,
    };
    heroStats(data, hero, stats);
    hero.hp = stats.maxHp;
    this.hero = hero;

    this.abilities = createAbilitySlots(this);
    refreshHeroStats(this); // the same path as every later refresh, so a starting aura counts

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
   *   applyActions(this, input);  // phase 2a, Task 7 (R, T, dash)
   *   moveHero(this, input);      // Task 3
   *   spawnEnemies(this);         // Task 4
   *   updateEnemies(this);        // Task 4
   *   healEnemies(this);          // phase 2b-1 (reads the grid built by updateEnemies)
   *   updateHeroCombat(this);     // Task 5
   *   updateAbilities(this);      // Task 6
   *   updateProjectiles(this);    // phase 2a, Task 4
   *   updateAllies(this);         // phase 2a, Task 6
   *   updateCrystals(this);       // Task 7
   *   regenCastle(this);          // Task 4
   *   this.tick++;
   *   checkEnd(this);             // castle (Task 4) -> hero (Task 5) -> time (Task 3); a loss wins over a win
   *   if (state === "playing" && hero.pendingLevelUps > 0) openOffer(this);   // Task 7
   */
  step(input: TickInput): void {
    if (this.state === "won" || this.state === "lost") return;
    this.events.clear();
    if (this.state === "levelUp") {
      chooseCard(this, input.card);
      return;
    }
    savePrevious(this);
    applyActions(this, input);
    moveHero(this, input);
    spawnEnemies(this);
    updateEnemies(this);
    healEnemies(this);
    updateHeroCombat(this);
    updateAbilities(this);
    updateProjectiles(this);
    updateAllies(this);
    updateCrystals(this);
    regenCastle(this);
    this.tick++;
    checkEnd(this);
    if (this.state === "playing" && this.hero.pendingLevelUps > 0) openOffer(this);
  }
}

function savePrevious(run: Run): void {
  const { hero, enemies, crystals, projectiles, allies } = run;
  hero.prevX = hero.x;
  hero.prevY = hero.y;
  for (let i = 0; i < crystals.capacity; i++) {
    if (crystals.alive[i] === 0) continue;
    crystals.prevX[i] = crystals.x[i];
    crystals.prevY[i] = crystals.y[i];
  }
  for (let i = 0; i < projectiles.capacity; i++) {
    if (projectiles.alive[i] === 0) continue;
    projectiles.prevX[i] = projectiles.x[i];
    projectiles.prevY[i] = projectiles.y[i];
  }
  for (let i = 0; i < allies.capacity; i++) {
    if (allies.alive[i] === 0) continue;
    allies.prevX[i] = allies.x[i];
    allies.prevY[i] = allies.y[i];
  }
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0) continue;
    enemies.prevX[i] = enemies.x[i];
    enemies.prevY[i] = enemies.y[i];
  }
}

function checkEnd(run: Run): void {
  if (run.castle.hp <= 0) {
    run.state = "lost";
    run.result = "castle";
    run.events.push(EventKind.RunEnd, 1, 0, 0, 0, 0, 0);
    return;
  }
  if (run.hero.hp <= 0) {
    run.state = "lost";
    run.result = "hero";
    run.events.push(EventKind.RunEnd, 2, 0, 0, 0, 0, 0);
    return;
  }
  if (run.tick >= run.durationTicks) {
    run.state = "won";
    run.result = "won";
    run.events.push(EventKind.RunEnd, 0, 0, 0, 0, 0, 0);
  }
}

export function createRun(data: GameData, options: RunOptions): Run {
  return new Run(data, options);
}
