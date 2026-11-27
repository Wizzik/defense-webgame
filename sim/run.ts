import type { DifficultyId, GameData } from "../data/schema";
import { createAbilitySlots, updateAbilities } from "./abilities/slots";
import { type BuffState, fillLifestealBudget, updateBuffs } from "./buffs";
import { createOrbs, type OrbStore, updateOrbs } from "./orbs";
import type { AbilitySlot } from "./abilities/slots";
import { TICKS_PER_SECOND } from "./constants";
import { chooseCard, openOffer } from "./cards";
import { coopChoose, coopOpen } from "./coop-choice";
import type { CardOffer } from "./cards";
import { type ChestOffer, ChestStore, chooseChestCard, placeChest, updateChests } from "./chests";
import { regenCastle } from "./castle";
import { HazardState, updateHazard } from "./hazard";
import { ALLY_CAPACITY, AllyStore, updateAllies } from "./allies";
import { PROJECTILE_CAPACITY, ProjectileStore, updateProjectiles } from "./projectiles";
import { COIN_CAPACITY, CRYSTAL_CAPACITY, CrystalStore, HEART_CAPACITY, updatePickups } from "./crystals";
import { updateEnemies } from "./enemy-ai";
import { BEHAVIOR_IDS } from "./enemy-steer";
import { healEnemies } from "./enemy-heal";
import { CORPSE_CAPACITY, CorpseRing } from "./corpses";
import { EnemyStore } from "./enemies";
import { updateClouds } from "./enemy-cloud";
import { EventKind, EventLog } from "./events";
import { applyThorns, ThornsStore } from "./thorns";
import { updateGearEffects } from "./gear-effects";
import { emptyGearBonus, type GearState, loadGear, type LoadoutEntry, recomputeGear } from "./gear";
import { refreshHeroStats } from "./level-up";
import { tickSnares } from "./hero-snares";
import { buildFactionTables, updateFaction } from "./factions";
import { applyActions, heroStats, moveHero, updateHeroCombat } from "./hero";
import { InputAction, NO_INPUT, type TickInput } from "./input";
import { Rng } from "./rng";
import { buildWorldMap, type WorldMap } from "./world-map/map";
import { FlowField } from "./world-map/flow";
import { spawnEnemies } from "./spawner";
import { applyStartPhase } from "./start-phase";
import { updateRevive } from "./revive";
import { checkCourse, type DifficultyMods, difficultyMods } from "./difficulty";
import { buildTimeline, type TimedEvent, updateTimeline } from "./timeline";
import { buildPhaseTables, enemyType, type PhaseTable } from "./spawn-tables";
import { SpatialHash } from "./spatial-grid";
import { PlayerState } from "./player";
import { emptyPassiveBonus } from "./world";
import type { CastleState, HeroState, HeroStats, RunStats } from "./world";

export type RunState = "playing" | "levelUp" | "chest" | "won" | "lost";
export type RunResult = "won" | "castle" | "hero";
/** One player of a run with several heroes (multiplayer migration, step 2). */
export interface PlayerOptions {
  /** Hero id; defaults to rules.start.hero. */
  hero?: string;
  /** Permanent items the hero wears (sim/gear.ts). */
  loadout?: readonly LoadoutEntry[];
}

/** How far apart the heroes of several players start, east and west of `arena.heroStart` (player 0 stands on it). */
export const PLAYER_START_SPACING = 120;

export interface RunOptions {
  seed: number;
  /** The players, 1 to 4; when given, `hero` and `loadout` are ignored. Defaults to one player of `hero` and `loadout`. */
  players?: readonly PlayerOptions[];
  durationSeconds?: number;
  /** Hero id; defaults to rules.start.hero. */
  hero?: string;
  /** Debug: start at this phase (1 to phases + 1, the last is the finale); see sim/start-phase.ts. */
  startPhase?: number;
  /** Permanent items the hero wears; entries that do not fit are skipped (sim/gear.ts). */
  loadout?: readonly LoadoutEntry[];
  /** World of the ladder, 1 to `data.worlds.length`; defaults to 1. */
  world?: number;
  /** Defaults to "normal". */
  difficulty?: DifficultyId;
}

/** One boss of the run, for run summaries. */
export interface BossRecord {
  type: number;
  spawnTick: number;
  /** -1 while it lives. */
  deathTick: number;
}

const EVENT_CAPACITY = 1024;

export class Run {
  readonly data: GameData;
  /** World of the ladder (1-based) and difficulty; `mods` are their multipliers (sim/difficulty.ts). */
  readonly world: number;
  readonly difficulty: DifficultyId;
  readonly mods: DifficultyMods;
  readonly rng: Rng;
  readonly events = new EventLog(EVENT_CAPACITY);
  /** The players of the run; `players[0]` is the single player (sim/player.ts). */
  readonly players: PlayerState[] = [];
  /**
   * The player whose systems run now. `run.hero`, `run.abilities`, `run.gold`, ... read and write
   * `players[current]`: `Run.step` sets it around every per-player system and around each ally and bolt
   * (their owner), and puts it back to 0 after; everything else (enemies, pickups, the castle) sees player 0.
   */
  get current(): number { return this.currentPlayer; }
  set current(value: number) {
    this.currentPlayer = value;
    this.events.who = value;
  }
  private currentPlayer = 0;
  /** The player whose card or chest offer holds the run in the "levelUp" or "chest" state. */
  choosing = 0;
  readonly castle: CastleState;
  readonly enemies: EnemyStore;
  readonly grid: SpatialHash;
  /** Thorns damage the enemies owe from melee hits on heroes, paid after updateEnemies (sim/thorns.ts). */
  readonly thorns: ThornsStore;
  readonly crystals = new CrystalStore(CRYSTAL_CAPACITY);
  /** Gold coins on the ground. */
  readonly coins = new CrystalStore(COIN_CAPACITY);
  /** Hearts on the ground (sim/combat.ts drops them, updatePickups kind 2 heals). */
  readonly hearts = new CrystalStore(HEART_CAPACITY);
  /** The chests on the map (sim/chests.ts). */
  readonly chests: ChestStore;
  /** Places of chests and their offers come from this generator, so chests do not shift the enemies of a seed. */
  /** The obstacle map of the run's world (sim/world-map/), its islands drawn from `mapRng` only. */
  readonly mapRng: Rng;
  readonly map: WorldMap;
  /** Flow field towards each player's hero (sim/world-map/hero-flow.ts); player 0's is `map.toHero`. */
  readonly heroFlows: FlowField[];
  readonly chestRng: Rng;
  chestsOpened = 0;
  /** Bosses that fell in this run; the order of a boss's death picks its drop (meta/drop.ts). */
  bossesKilled = 0;
  readonly projectiles = new ProjectileStore(PROJECTILE_CAPACITY);
  readonly allies = new AllyStore(ALLY_CAPACITY);
  /** Weighted enemy types per phase, built once here so a step does not allocate. */
  readonly phaseTables: PhaseTable[];
  /** Enemy type index to its Behavior. */
  readonly enemyBehavior: Uint8Array;
  /** 1 for an enemy type that goes for the hero whatever its role is. */
  readonly enemyHunter: Uint8Array;
  /** 1 for every enemy type that carries an aura (sim/enemy-aura.ts). */
  readonly hasAura: Uint8Array;
  /** Faction index per 0-based phase index (sim/factions.ts). */
  readonly phaseFaction: Uint8Array;
  /** Type index of each faction's elite and of its heavy type (rushes). */
  readonly eliteTypes: Int32Array;
  readonly heavyTypes: Int32Array;
  /** 1 for every enemy type that is the elite of a faction. */
  readonly isElite: Uint8Array;
  /** Places of the last deaths of common enemies, for gravebinders (sim/enemy-raise.ts). */
  readonly corpses = new CorpseRing(CORPSE_CAPACITY);
  /** Type index each type raises (its `raise.type`), -1 for a type that raises nothing. */
  readonly raiseTypes: Int32Array;
  /** The faction of the current phase; updateFaction announces a change. */
  factionIndex = 0;
  /** `rules.events` prepared for the steps (sim/timeline.ts). */
  readonly timeline: TimedEvent[];
  /** Index of the next event of `timeline`. */
  nextEvent = 0;
  /** The next rush was announced; its side is in rushDirX/rushDirY. */
  rushWarned = false;
  rushDirX = 1;
  rushDirY = 0;
  /** 1 for every enemy type that is a boss. */
  readonly isBoss: Uint8Array;
  /** Living bosses. */
  bossCount = 0;
  /** Type index of the final boss (`rules.run.finale.boss`). */
  readonly finalBossType: number;
  /** Slot of the living final boss; -1 before it comes and after it falls. */
  finalBossSlot = -1;
  /** The final boss fell: the run is won at the end of the step. */
  finalBossDead = false;
  /** The final boss is enraged (`rules.run.finale.enrage`). */
  enraged = false;
  /** Every boss that came, in the order of arrival; the first `bossLogCount` entries are used. */
  readonly bossLog: BossRecord[];
  bossLogCount = 0;
  /** Multiplies the cooldown drawn after a slam (the enrage of the final boss lowers it). */
  slamCooldownScale = 1;
  /** The step in which the next pack comes. */
  nextPackTick: number;
  /** The last phase whose elites were sent (-1: none yet). */
  elitePhase = -1;
  readonly stats: RunStats = {
    kills: 0, spawned: 0, damageDealt: 0, xpGained: 0, goldGained: 0,
    hearts: 0, orbsBoots: 0, orbsBerserk: 0, orbsHeal: 0, healedLifesteal: 0, healedHearts: 0, healedOrb: 0,
    cloudDamage: 0, rootedTicks: 0, raised: 0,
  };
  /** Hearts and orbs draw from this generator, so they shift neither the enemies nor the chests of a seed. */
  readonly sustainRng: Rng;
  /** The world's natural event (sim/hazard.ts) and its own rng. */
  readonly hazardRng: Rng;
  readonly hazard: HazardState;
  /** The orb places on the map (sim/orbs.ts). */
  readonly orbs: OrbStore;
  /** The step in which the final boss comes. The run goes on until it falls. */
  readonly durationTicks: number;
  tick = 0;
  state: RunState = "playing";
  result: RunResult | null = null;

  constructor(data: GameData, options: RunOptions) {
    const { rules } = data;
    this.data = data;
    this.world = options.world ?? 1;
    this.difficulty = checkCourse(data, this.world, options.difficulty ?? "normal");
    const players: readonly PlayerOptions[] = options.players ?? [{ hero: options.hero, loadout: options.loadout }];
    if (players.length < 1 || players.length > MAX_PLAYERS) {
      throw new Error(`createRun: 1 to ${MAX_PLAYERS} players, got ${players.length}`);
    }
    this.mods = difficultyMods(rules, this.world, this.difficulty, players.length, data.worlds[this.world - 1]!.strength ?? 1);
    this.rng = new Rng(options.seed);
    this.enemies = new EnemyStore(rules.enemies.maxAlive);
    this.grid = new SpatialHash(128, rules.enemies.maxAlive);
    this.thorns = new ThornsStore(rules.enemies.maxAlive);
    this.enemyBehavior = Uint8Array.from(data.enemies, (e) => BEHAVIOR_IDS.indexOf(e.behavior));
    this.enemyHunter = Uint8Array.from(data.enemies, (e) => (e.hunter ? 1 : 0));
    this.raiseTypes = Int32Array.from(data.enemies, (e, i) =>
      e.raise === undefined ? -1 : enemyType(data, e.raise.type, `enemies.${i}.raise.type`));
    this.hasAura = Uint8Array.from(data.enemies, (e) => (e.aura !== undefined ? 1 : 0));
    const factions = buildFactionTables(data);
    this.phaseFaction = factions.phaseFaction;
    this.eliteTypes = factions.eliteTypes;
    this.heavyTypes = factions.heavyTypes;
    this.isElite = factions.isElite;
    this.isBoss = Uint8Array.from(data.enemies, (e) => (e.boss ? 1 : 0));
    this.phaseTables = buildPhaseTables(data);
    this.timeline = buildTimeline(data, this.difficulty);
    this.finalBossType = enemyType(data, rules.run.finale.boss, "rules.run.finale.boss");
    this.bossLog = Array.from(
      { length: this.timeline.filter((event) => event.boss >= 0).length + 1 },
      () => ({ type: -1, spawnTick: -1, deathTick: -1 }),
    );
    this.nextPackTick = Math.round(rules.run.firstPackSeconds * TICKS_PER_SECOND);
    this.durationTicks = Math.round(
      (options.durationSeconds ?? rules.run.durationSeconds) * TICKS_PER_SECOND,
    );

    for (let p = 0; p < players.length; p++) this.players.push(createPlayer(data, players[p]!, p));
    for (let p = 0; p < players.length; p++) {
      this.current = p;
      const player = this.players[p]!;
      player.abilities = createAbilitySlots(this);
      refreshHeroStats(this); // the same path as every later refresh, so a starting aura counts
      const loadout = players[p]!.loadout;
      if (loadout !== undefined) loadGear(this, loadout);
      recomputeGear(this); // a living hero's hp grows with maxHp, so the hero starts full
    }
    this.current = 0;

    // co-op (multiplayer migration step 8): every player after the first adds rules.coop.perPlayer.castleHp
    const castleHp = rules.castle.hp * (1 + rules.coop.perPlayer.castleHp * (players.length - 1));
    this.castle = {
      x: rules.arena.castle.x, y: rules.arena.castle.y, radius: rules.castle.radius,
      hp: castleHp, maxHp: castleHp, lastHitTick: -1,
    };
    this.mapRng = new Rng((options.seed ^ 0x68e31da4) >>> 0);
    this.map = buildWorldMap(data, this.world, this.mapRng);
    this.heroFlows = this.players.map((_, p) => (p === 0 ? this.map.toHero : new FlowField()));
    this.chestRng = new Rng((options.seed ^ 0x5bd1e995) >>> 0);
    this.sustainRng = new Rng((options.seed ^ 0x27d4eb2f) >>> 0);
    this.hazardRng = new Rng((options.seed ^ 0x1b873593) >>> 0);
    this.hazard = new HazardState(this.players.length);
    this.orbs = createOrbs(this);
    // co-op: more chests per extra player; each player pays his own price curve (PlayerState.chestPriceRaw)
    const chestCount = rules.chests.count + rules.coop.perPlayer.chests * (this.players.length - 1);
    this.chests = new ChestStore(chestCount);
    for (let i = 0; i < chestCount; i++) placeChest(this, i, true);
    if (options.startPhase !== undefined) applyStartPhase(this, options.startPhase);
    for (let p = 0; p < this.players.length; p++) {
      this.current = p;
      fillLifestealBudget(this);
    }
    this.current = 0;
  }

  // The current player (see `current`) through the fields of the one-hero run (multiplayer migration):
  // single-player code and the tests keep reading `run.hero`, `run.gold`, ...
  get hero(): HeroState { return this.players[this.current].hero; }
  get heroIndex(): number { return this.players[this.current].heroIndex; }
  get abilities(): AbilitySlot[] { return this.players[this.current].abilities; }
  get gear(): GearState { return this.players[this.current].gear; }
  get buffs(): BuffState { return this.players[this.current].buffs; }
  get gold(): number { return this.players[this.current].gold; }
  set gold(value: number) { this.players[this.current].gold = value; }
  get offer(): CardOffer | null { return this.players[this.current].offer; }
  set offer(value: CardOffer | null) { this.players[this.current].offer = value; }
  get chestOffer(): ChestOffer | null { return this.players[this.current].chestOffer; }
  set chestOffer(value: ChestOffer | null) { this.players[this.current].chestOffer = value; }
  get openChest(): number { return this.players[this.current].openChest; }
  set openChest(value: number) { this.players[this.current].openChest = value; }
  get ultimateAuto(): boolean { return this.players[this.current].ultimateAuto; }
  set ultimateAuto(value: boolean) { this.players[this.current].ultimateAuto = value; }
  get ultimateRequested(): boolean { return this.players[this.current].ultimateRequested; }
  set ultimateRequested(value: boolean) { this.players[this.current].ultimateRequested = value; }
  /** The current player's price of his next chest before rounding (each player pays his own curve). */
  get chestPriceRaw(): number { return this.players[this.current].chestPriceRaw; }
  set chestPriceRaw(value: number) { this.players[this.current].chestPriceRaw = value; }
  get shieldTicks(): number { return this.players[this.current].shieldTicks; }
  set shieldTicks(value: number) { this.players[this.current].shieldTicks = value; }

  /** The time of the final boss has come. */
  get inFinale(): boolean {
    return this.tick >= this.durationTicks;
  }

  get timeSeconds(): number {
    return this.tick / TICKS_PER_SECOND;
  }

  get phaseIndex(): number {
    const { run, phases } = this.data.rules;
    if (this.inFinale) return phases.length - 1;
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
   *   tickSnares(this);           // enemy factions: web and roots count down after the move they held
   *   updateFaction(this);        // enemy factions: the faction of the phase, announced when it changes
   *   updateTimeline(this);       // phase 2b-3 (elite rushes and bosses by time)
   *   spawnEnemies(this);         // Task 4
   *   updateEnemies(this);        // Task 4
   *   applyThorns(this);          // random items: thorns of gear hit back the melee enemies that hit a hero
   *   updateClouds(this);         // enemy factions: poison clouds hurt the hero (once per player)
   *   healEnemies(this);          // phase 2b-1 (reads the grid built by updateEnemies)
   *   updateHeroCombat(this);     // Task 5
   *   updateAbilities(this);      // Task 6
   *   updateGearEffects(this);    // gear plan, Task 7 (shield, haste and aura of worn items)
   *   updateProjectiles(this);    // phase 2a, Task 4
   *   updateAllies(this);         // phase 2a, Task 6
   *   updatePickups(this, crystals, 0);   // Task 7
   *   updatePickups(this, coins, 1);      // gear plan, Task 3
   *   updatePickups(this, hearts, 2);     // sustain plan, Task 3 (a fallen hero is not healed)
   *   updateOrbs(this);           // sustain plan, Task 4: orb spawns, respawns and pickups (no magnet)
   *   updateBuffs(this);          // sustain plan, Task 2: orb timers, heal over time, lifesteal budget and its event
   *   updateHazard(this);         // difficulties plan 2: the storm's bolts and waves
   *   updateRevive(this);         // multiplayer step 6: a teammate standing by a fallen hero revives him (co-op only)
   *   regenCastle(this);          // Task 4
   *   this.tick++;
   *   checkEnd(this);             // castle (Task 4) -> hero (Task 5) -> the final boss fell (phase 2b-3); a loss wins over a win
   *   if (state === "playing" && hero.pendingLevelUps > 0) openOffer(this);   // Task 7
   *   else if (state === "playing") updateChests(this);   // gear plan, Task 4: after the end check and the cards
   *
   * With several players (multiplayer migration step 2) the hero systems run once per player with `current` set to
   * him, each in its own loop at its line above: applyActions, moveHero, tickSnares, updateHeroCombat, updateAbilities,
   * updateGearEffects and updateBuffs; savePrevious covers every hero. Allies and bolts act as their owner. The offer
   * goes to the first player with level-ups, else the first player on a chest opens it; `choosing` is that player.
   * That is the one-player rule only: with several players (step 5) offers and chests never pause the run; each player
   * picks through his own input at the start of a step (coopChoose) and opens his next offer or chest at its end
   * (coopOpen), with a choice time of CHOICE_SECONDS in which his hero is immune, idle and ignored (sim/coop-choice.ts).
   * updateClouds runs once per player. Enemies pick their target player themselves (sim/targets.ts, step 3); pickups
   * and orbs go to the nearest hero and XP to all (step 4). The run is lost when every hero has fallen at once; a fallen
   * hero does not move and is revived by a teammate standing by him (sim/revive.ts, step 6).
   *
   * In the "chest" state only chooseChestCard runs (the KeepWorn bit keeps the worn item of a Choice), like chooseCard in "levelUp".
   */
  step(input: TickInput | readonly TickInput[]): void {
    // first, also for a finished run: the client keeps stepping it, and the events of its last step
    // (a boss's death and so its drop) must reach the views once
    this.events.clear();
    if (this.state === "won" || this.state === "lost") return;
    const count = this.players.length;
    if (this.state === "levelUp") {
      this.current = this.choosing;
      chooseCard(this, inputOf(input, this.choosing).card);
      this.current = 0;
      return;
    }
    if (this.state === "chest") {
      const own = inputOf(input, this.choosing);
      this.current = this.choosing;
      chooseChestCard(this, own.card, (own.actions & InputAction.KeepWorn) !== 0);
      this.current = 0;
      return;
    }
    if (count > 1) {
      // co-op: offers and chests never pause the run; each player picks through his own input (step 5)
      for (let p = 0; p < count; p++) {
        this.current = p;
        coopChoose(this, inputOf(input, p));
      }
      this.current = 0;
    }
    savePrevious(this);
    for (let p = 0; p < count; p++) {
      this.current = p;
      applyActions(this, inputOf(input, p));
    }
    for (let p = 0; p < count; p++) {
      this.current = p;
      moveHero(this, inputOf(input, p));
    }
    for (let p = 0; p < count; p++) {
      this.current = p;
      tickSnares(this);
    }
    this.current = 0;
    updateFaction(this);
    updateTimeline(this);
    spawnEnemies(this);
    updateEnemies(this);
    applyThorns(this);
    for (let p = 0; p < count; p++) {
      this.current = p;
      updateClouds(this);
    }
    this.current = 0;
    healEnemies(this);
    for (let p = 0; p < count; p++) {
      this.current = p;
      updateHeroCombat(this);
    }
    for (let p = 0; p < count; p++) {
      this.current = p;
      updateAbilities(this);
    }
    for (let p = 0; p < count; p++) {
      this.current = p;
      updateGearEffects(this);
    }
    this.current = 0;
    updateProjectiles(this);
    updateAllies(this);
    updatePickups(this, this.crystals, 0);
    updatePickups(this, this.coins, 1);
    updatePickups(this, this.hearts, 2);
    updateOrbs(this);
    for (let p = 0; p < count; p++) {
      this.current = p;
      updateBuffs(this);
    }
    this.current = 0;
    updateHazard(this);
    updateRevive(this);
    regenCastle(this);
    this.tick++;
    checkEnd(this);
    if (this.state !== "playing") return;
    if (count > 1) {
      for (let p = 0; p < count; p++) {
        this.current = p;
        coopOpen(this);
      }
      this.current = 0;
      return;
    }
    for (let p = 0; p < count; p++) {
      if (this.players[p]!.hero.pendingLevelUps === 0) continue;
      this.current = p;
      this.choosing = p;
      openOffer(this);
      this.current = 0;
      return;
    }
    for (let p = 0; p < count; p++) {
      this.current = p;
      updateChests(this);
      if ((this.state as RunState) === "chest") {
        this.choosing = p;
        break;
      }
    }
    this.current = 0;
  }
}

/** Most players of one run. */
export const MAX_PLAYERS = 4;

/** The input of player `p`: a single input steers player 0 only, a missing one is no input. */
function inputOf(input: TickInput | readonly TickInput[], p: number): Readonly<TickInput> {
  if (isInputList(input)) return input[p] ?? NO_INPUT;
  return p === 0 ? input : NO_INPUT;
}

function isInputList(input: TickInput | readonly TickInput[]): input is readonly TickInput[] {
  return Array.isArray(input);
}

function createPlayer(data: GameData, options: PlayerOptions, p: number): PlayerState {
  const { rules } = data;
  const heroId = options.hero ?? rules.start.hero;
  const heroIndex = data.heroes.findIndex((h) => h.id === heroId);
  if (heroIndex < 0) throw new Error(`createRun: unknown hero "${heroId}"`);
  const def = data.heroes[heroIndex];
  const stats: HeroStats = {
    maxHp: 0, regenPerSecond: 0, armor: 0, attackIntervalSeconds: 0, damageMin: 0, damageMax: 0,
    spellPower: 0, cooldownScale: 0, moveSpeed: 0, collision: 0,
    critChance: 0, critDamage: 0, dodge: 0, damageTakenScale: 1, thorns: 0, ultimateScale: 1, areaScale: 1,
  };
  const start = rules.arena.heroStart;
  // player 0 on the start, then east, west, further east: 0, +1, -1, +2 spacings
  const shift = p === 0 ? 0 : (p % 2 === 1 ? 1 : -1) * Math.ceil(p / 2) * PLAYER_START_SPACING;
  const x = start.x + shift;
  const hero: HeroState = {
    def, x, y: start.y, prevX: x, prevY: start.y,
    facingX: 0, facingY: 1, moving: false,
    level: 1, xp: 0,
    str: def.attributes.str.base, agi: def.attributes.agi.base, int: def.attributes.int.base,
    hp: 0, stats, bonus: { damage: 0, moveSpeed: 0, attackSpeed: 0 }, gear: emptyGearBonus(), passive: emptyPassiveBonus(), attackCooldown: 0, pendingLevelUps: 0, speedScale: 1,
    dashTicks: 0, dashCooldown: 0, dashCharges: 1, blinkCooldown: 0, dashDirX: 0, dashDirY: 0, slowTicks: 0, slowShare: 0, rootTicks: 0,
  };
  heroStats(data, hero, stats);
  hero.hp = stats.maxHp;
  const player = new PlayerState(hero, heroIndex, rules.enemies.maxAlive);
  player.chestPriceRaw = rules.chests.basePrice;
  return player;
}

function savePrevious(run: Run): void {
  const { enemies, crystals, coins, hearts, projectiles, allies } = run;
  for (let p = 0; p < run.players.length; p++) {
    const hero = run.players[p]!.hero;
    hero.prevX = hero.x;
    hero.prevY = hero.y;
  }
  for (let i = 0; i < crystals.capacity; i++) {
    if (crystals.alive[i] === 0) continue;
    crystals.prevX[i] = crystals.x[i];
    crystals.prevY[i] = crystals.y[i];
  }
  for (let i = 0; i < coins.capacity; i++) {
    if (coins.alive[i] === 0) continue;
    coins.prevX[i] = coins.x[i];
    coins.prevY[i] = coins.y[i];
  }
  for (let i = 0; i < hearts.capacity; i++) {
    if (hearts.alive[i] === 0) continue;
    hearts.prevX[i] = hearts.x[i];
    hearts.prevY[i] = hearts.y[i];
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
  if (allHeroesDown(run)) {
    run.state = "lost";
    run.result = "hero";
    run.events.push(EventKind.RunEnd, 2, 0, 0, 0, 0, 0);
    return;
  }
  if (run.finalBossDead) {
    run.state = "won";
    run.result = "won";
    run.events.push(EventKind.RunEnd, 0, 0, 0, 0, 0, 0);
  }
}

export function createRun(data: GameData, options: RunOptions): Run {
  return new Run(data, options);
}

/** Every hero has fallen (one player: the hero fell). */
function allHeroesDown(run: Run): boolean {
  for (let p = 0; p < run.players.length; p++) if (run.players[p]!.hero.hp > 0) return false;
  return true;
}
