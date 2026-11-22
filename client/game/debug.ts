import type { GearSession } from "./gear-session";
import type { DifficultyId, Rarity } from "../../data/schema";
import { groundSpeedScale,
  type ChestOffer, chestPrice, debugDropHeart, debugGrantGold, debugGrantXp, debugSetAbilityLevel, debugSpawnEach, debugSpawnOrb,
  debugWear, killEnemy, learnAbility, OrbKind, debugHazard, hazardPending,
  type Run,
  SLOT_IDS, type SlotId, TICKS_PER_SECOND,
} from "../../sim";
import { latestBoss, runPhase } from "./boss";
import type { Backend, GpuInfo } from "../render/gpu";

const CHEST_ACTIONS = ["new", "choice", "level"] as const;
/** Orb kinds by OrbKind value. */
const ORB_TYPES = ["boots", "berserk", "heal"] as const;
type OrbType = (typeof ORB_TYPES)[number];
/** The chest offer `chestCards` was built from. */
let shownOffer: ChestOffer | null = null;

/** Read by the e2e tests; refreshed every frame. */
export interface GameSnapshot {
  backend: Backend;
  gpu: GpuInfo;
  frames: number;
  screen: "menu" | "playing" | "levelUp" | "chest" | "won" | "lost";
  tick: number;
  level: number;
  kills: number;
  heroHp: number;
  castleHp: number;
  enemies: number;
  /** How many different enemy types are alive. */
  enemyTypes: number;
  hero: string;
  heroX: number;
  heroY: number;
  /** Level per slot (10 slots: 0-2 signature, 3 ultimate, 4-5 shared spells, 6-9 passives; 0 = not learned). */
  abilityLevels: number[];
  /** Ticks left per slot. */
  abilityCooldowns: number[];
  /** Ability id per slot, "" for an empty shared-spell or passive slot. */
  abilityIds: string[];
  ultimateAuto: boolean;
  allies: number;
  projectiles: number;
  /** Pack arrows on screen. */
  packArrows: number;
  /** Enemies in a charge (windup or run). */
  charging: number;
  /** Phase of the run from 1; the finale is one past the last phase (21). */
  phase: number;
  /** The living boss that came last; `x`, `y` are simulation coordinates. */
  boss: { id: string; hp: number; maxHp: number; x: number; y: number } | null;
  /** Slams winding up (warning circles on the ground). */
  slams: number;
  /** What the renderer built: `heroModels` is how many hero figures stand in the scene (refreshed every frame), `slamRings` how many slam circles lie on the floor, `particles` how many weather particles are drawn. */
  render: { enemyMeshes: number; heroModels: number; shadows: boolean; slamRings: number; hazardRings: number; particles: number };
  /** Gold the hero holds. */
  gold: number;
  /** Gold the next chest costs. */
  chestPrice: number;
  /** The chests on the map, in simulation coordinates. */
  chests: { x: number; y: number }[];
  chestsOpened: number;
  /** The cards of the open chest (slot id, item id, its rarity, what the pick does); null outside the "chest" screen. */
  chestCards: { slot: SlotId; item: string; rarity: Rarity; action: "new" | "choice" | "level" }[] | null;
  /** Index of the chest card whose compare panel is open, or null. */
  chestCompare: number | null;
  /** The settings panel is open. */
  settingsOpen: boolean;
  /** The 16 gear slots in the order of `SLOT_IDS`: item id and levels, or null for an empty slot. */
  gear: ({ item: string; base: number; temp: number } | null)[];
  /** The player's collection: item id to its permanent level. */
  collection: Record<string, number>;
  /** Whether the gear is stored in this browser (false with ?debug=1 and without storage). */
  gearSaved: boolean;
  /** The living orbs on the map, in simulation coordinates. */
  orbs: { type: OrbType; x: number; y: number }[];
  /** Hearts on the ground. */
  hearts: number;
  /** Seconds left of each orb effect (0 when it does not run). */
  buffs: { boots: number; berserk: number; heal: number };
  /** The hero's lifesteal from gear (a share). */
  lifesteal: number;
  /** Id of the enemy faction of the current phase (`human`, `orc`, `undead`, `elf`). */
  faction: string;
  /** Seconds left of the web's slow and of the roots on the hero (0 when none runs). */
  slowed: number;
  rooted: number;
  /** World (1-5) and difficulty of the current run. */
  world: number;
  difficulty: DifficultyId;
  /** courseKey ("3-insane") of every unlocked world and difficulty. */
  unlocked: string[];
  /** Whether the world progress is stored in this browser (false with ?debug=1 and without storage). */
  progressSaved: boolean;
  /** Obstacles of the run's map: islands + wall segments. */
  obstacles: number;
  /**
   * The world's natural event: its kind, seconds until the nearest bolt strikes (0 when none waits), storm waves or
   * weathers so far, seconds left of the running weather, seconds until an announced weather starts, and the walking
   * speed scale of the ground under the hero (paths 1.15, thicket 0.7, else 1).
   */
  hazard: { kind: "storm" | "weather" | "thicket"; pending: number; waves: number; weather: number; warning: number; ground: number };
  /** Only with ?debug=1. */
  debug?: {
    grantXp(amount: number): void;
    grantGold(amount: number): void;
    /** Puts an item into the collection at a permanent level. */
    grantItem(id: string, level: number): void;
    /** Empties the collection and the dolls. */
    clearGear(): void;
    setAbilityLevel(slot: number, level: number): void;
    /** Learns a shared spell or passive (by id) into an empty slot; throws an Error when the rules refuse it. */
    learn(slot: number, abilityId: string): void;
    /** One hunter of every common enemy type of the current faction (no risen), in a row north of the hero. */
    spawnEach(): void;
    /** One hunter of every type of the faction `id` (no risen); throws an Error for an unknown faction. */
    spawnFaction(id: string): void;
    /** Moves the hero to simulation coordinates, clamped to the arena. */
    teleport(x: number, y: number): void;
    /** Kills every living boss; the fall of the final boss wins the run in the next step. */
    killBoss(): void;
    /** Picks chest card `index` through the next step's input; for a Choice card `side` keeps or takes. */
    chooseChest(index: number, side: "keep" | "take"): void;
    /** Puts an item (by id) into a gear slot (by id) of the run as a chest item at level 1; throws on an unknown id. */
    wear(slotId: string, itemId: string): void;
    /** An orb of the type 150 ahead of the hero; throws on an unknown type. */
    spawnOrb(type: string): void;
    /** A heart 100 ahead of the hero. */
    dropHeart(): void;
    /** A wave of the world's storm, or its weather, at once (nothing in a thicket world). */
    hazard(): void;
  };
}

declare global {
  interface Window {
    __game?: GameSnapshot;
  }
}

/** Creates the snapshot and publishes it as `window.__game`. */
export function publishSnapshot(backend: Backend, gpu: GpuInfo): GameSnapshot {
  const snapshot: GameSnapshot = {
    backend, gpu, frames: 0, screen: "menu", tick: 0, level: 0, kills: 0, heroHp: 0, castleHp: 0, enemies: 0, enemyTypes: 0,
    hero: "", heroX: 0, heroY: 0, abilityLevels: [], abilityCooldowns: [], abilityIds: [], ultimateAuto: true, allies: 0,
    projectiles: 0, packArrows: 0, charging: 0, phase: 1, boss: null, slams: 0,
    render: { enemyMeshes: 0, heroModels: 0, shadows: false, slamRings: 0, hazardRings: 0, particles: 0 },
    gold: 0, chestPrice: 0, chests: [], chestsOpened: 0, chestCards: null, chestCompare: null, settingsOpen: false, gear: [], collection: {}, gearSaved: false,
    orbs: [], hearts: 0, buffs: { boots: 0, berserk: 0, heal: 0 }, lifesteal: 0,
    faction: "human", slowed: 0, rooted: 0, world: 1, difficulty: "normal", unlocked: [], progressSaved: false,
    obstacles: 0, hazard: { kind: "storm", pending: 0, waves: 0, weather: 0, warning: 0, ground: 1 },
  };
  window.__game = snapshot;
  return snapshot;
}

/** Adds `window.__game.debug`; `getRun` is read at call time because the run is replaced on every start. */
/** `deliver` hands the run's events to the views, as the session does after a step; `pick` sets the next step's card. */
export function addDebugHooks(
  snapshot: GameSnapshot, getRun: () => Run | null, gear: GearSession, deliver: (run: Run) => void,
  pick: (index: number, keep: boolean) => void,
): void {
  snapshot.debug = {
    grantXp(amount: number): void {
      const run = getRun();
      if (run) debugGrantXp(run, amount);
    },
    // the snapshot's collection is refreshed once a frame; a test that reads it right after a change must not
    // depend on a frame having passed (a slow software renderer), so these two publish at once
    grantItem(id: string, level: number): void {
      gear.grant(id, level);
      snapshot.collection = gear.save.items;
    },
    clearGear(): void {
      gear.clear();
      snapshot.collection = gear.save.items;
    },
    grantGold(amount: number): void {
      const run = getRun();
      if (run) debugGrantGold(run, amount);
    },
    setAbilityLevel(slot: number, level: number): void {
      const run = getRun();
      if (run) debugSetAbilityLevel(run, slot, level);
    },
    learn(slot: number, abilityId: string): void {
      const run = getRun();
      if (!run) return;
      const index = run.data.abilities.findIndex((a) => a.id === abilityId);
      if (index < 0) throw new Error(`debug.learn: unknown ability "${abilityId}"`);
      learnAbility(run, slot, index);
    },
    spawnEach(): void {
      const run = getRun();
      if (run) debugSpawnEach(run);
    },
    spawnFaction(id: string): void {
      const run = getRun();
      if (!run) return;
      const faction = run.data.rules.factions.find((f) => f.id === id);
      if (!faction) throw new Error(`debug.spawnFaction: unknown faction "${id}"`);
      debugSpawnEach(run, faction.id);
    },
    teleport(x: number, y: number): void {
      const run = getRun();
      if (!run) return;
      const { hero } = run;
      const { arena } = run.data.rules;
      const limitX = arena.width / 2 - hero.stats.collision;
      const limitY = arena.height / 2 - hero.stats.collision;
      hero.x = hero.prevX = Math.max(-limitX, Math.min(limitX, x));
      hero.y = hero.prevY = Math.max(-limitY, Math.min(limitY, y));
    },
    killBoss(): void {
      const run = getRun();
      if (!run) return;
      const { enemies } = run;
      // the kill happens between two steps: its events (death, boss death and the drop) are delivered here
      run.events.clear();
      for (let i = 0; i < enemies.capacity; i++) {
        if (enemies.alive[i] === 1 && run.isBoss[enemies.type[i]!] === 1) killEnemy(run, i);
      }
      deliver(run);
    },
    chooseChest(index: number, side: "keep" | "take"): void {
      pick(index, side === "keep");
    },
    wear(slotId: string, itemId: string): void {
      const run = getRun();
      if (!run) return;
      const slot = (SLOT_IDS as readonly string[]).indexOf(slotId);
      if (slot < 0) throw new Error(`debug.wear: unknown slot "${slotId}"`);
      const item = run.data.items.findIndex((i) => i.id === itemId);
      if (item < 0) throw new Error(`debug.wear: unknown item "${itemId}"`);
      debugWear(run, slot, item);
    },
    spawnOrb(type: string): void {
      const kind = (ORB_TYPES as readonly string[]).indexOf(type);
      if (kind < 0) throw new Error(`debug.spawnOrb: unknown type "${type}"`);
      const run = getRun();
      if (run) debugSpawnOrb(run, kind as OrbKind);
    },
    dropHeart(): void {
      const run = getRun();
      if (run) debugDropHeart(run);
    },
    hazard(): void {
      const run = getRun();
      if (!run) return;
      // the warnings are events of no step: hand them to the views now, the next step clears them
      run.events.clear();
      debugHazard(run);
      deliver(run);
    },
  };
}

/** Scratch for `countTypes`; it grows only when the data has more enemy types. */
let seenTypes = new Uint8Array(0);

/** Different enemy types alive, without allocating. */
function countTypes(run: Run): number {
  const types = run.data.enemies.length;
  if (seenTypes.length < types) seenTypes = new Uint8Array(types);
  seenTypes.fill(0);
  const { enemies } = run;
  let n = 0;
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0) continue;
    const type = enemies.type[i]!;
    if (seenTypes[type] === 0) {
      seenTypes[type] = 1;
      n++;
    }
  }
  return n;
}

/** Counts a rendered frame and copies the run state; `menuOpen` shows "menu" in place of the run state. */
export function updateSnapshot(snapshot: GameSnapshot, run: Run | null, menuOpen: boolean, packArrows = 0): void {
  snapshot.frames++;
  if (!run) return;
  snapshot.screen = menuOpen ? "menu" : run.state;
  snapshot.tick = run.tick;
  snapshot.level = run.hero.level;
  snapshot.kills = run.stats.kills;
  snapshot.heroHp = run.hero.hp;
  snapshot.castleHp = run.castle.hp;
  snapshot.enemies = run.enemies.aliveCount;
  snapshot.enemyTypes = countTypes(run);
  snapshot.hero = run.hero.def.id;
  snapshot.world = run.world;
  snapshot.obstacles = run.map.islandCount + run.map.segCount;
  snapshot.hazard.pending = hazardPending(run) / TICKS_PER_SECOND;
  snapshot.hazard.waves = run.hazard.waves;
  snapshot.hazard.kind = run.data.worlds[run.world - 1]!.hazard.kind;
  snapshot.hazard.weather = run.hazard.weatherTicks / TICKS_PER_SECOND;
  snapshot.hazard.warning = run.hazard.warnTicks / TICKS_PER_SECOND;
  snapshot.hazard.ground = groundSpeedScale(run.map, run.hero.x, run.hero.y);
  snapshot.difficulty = run.difficulty;
  snapshot.heroX = run.hero.x;
  snapshot.heroY = run.hero.y;
  // the slot count is fixed (10), so these arrays are filled in place after the first frame
  const { abilities } = run;
  snapshot.abilityLevels.length = abilities.length;
  snapshot.abilityCooldowns.length = abilities.length;
  snapshot.abilityIds.length = abilities.length;
  for (let i = 0; i < abilities.length; i++) {
    snapshot.abilityLevels[i] = abilities[i]!.level;
    snapshot.abilityCooldowns[i] = abilities[i]!.cooldown;
    snapshot.abilityIds[i] = abilities[i]!.def.id;
  }
  snapshot.ultimateAuto = run.ultimateAuto;
  snapshot.allies = run.allies.count;
  snapshot.projectiles = run.projectiles.count;
  snapshot.packArrows = packArrows;
  let charging = 0;
  let slams = 0;
  const { enemies } = run;
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0) continue;
    if (enemies.chargeState[i] !== 0) charging++;
    if (enemies.slamState[i] !== 0) slams++;
  }
  snapshot.charging = charging;
  snapshot.slams = slams;
  snapshot.gold = run.gold;
  snapshot.chestPrice = chestPrice(run);
  snapshot.chestsOpened = run.chestsOpened;
  // fixed sizes: the objects are made once and filled in place
  const { chests, gear } = run;
  while (snapshot.chests.length < chests.x.length) snapshot.chests.push({ x: 0, y: 0 });
  for (let i = 0; i < chests.x.length; i++) {
    snapshot.chests[i]!.x = chests.x[i]!;
    snapshot.chests[i]!.y = chests.y[i]!;
  }
  const offer = run.state === "chest" ? run.chestOffer : null;
  if (offer !== shownOffer) {
    // rebuilt only when the offer changes, not every frame
    shownOffer = offer;
    snapshot.chestCards = offer
      ? offer.cards.map((card) => ({
        slot: SLOT_IDS[card.slot]!,
        item: run.data.items[card.item]!.id,
        rarity: run.data.items[card.item]!.rarity,
        action: CHEST_ACTIONS[card.action]!,
      }))
      : null;
  }
  snapshot.gear.length = gear.item.length;
  for (let slot = 0; slot < gear.item.length; slot++) {
    const index = gear.item[slot]!;
    if (index < 0) {
      snapshot.gear[slot] = null;
      continue;
    }
    const entry = snapshot.gear[slot] ?? (snapshot.gear[slot] = { item: "", base: 0, temp: 0 });
    entry.item = run.data.items[index]!.id;
    entry.base = gear.base[slot]!;
    entry.temp = gear.temp[slot]!;
  }
  // the orb objects are made once per place and filled in place; the array holds the living ones
  const { orbs, buffs } = run;
  let live = 0;
  for (let i = 0; i < orbs.alive.length; i++) {
    if (orbs.alive[i] === 0) continue;
    const entry = snapshot.orbs[live] ?? (snapshot.orbs[live] = { type: "boots", x: 0, y: 0 });
    entry.type = ORB_TYPES[orbs.kind[i]!] ?? "boots";
    entry.x = orbs.x[i]!;
    entry.y = orbs.y[i]!;
    live++;
  }
  snapshot.orbs.length = live;
  snapshot.hearts = run.hearts.count;
  snapshot.buffs.boots = buffs.bootsTicks / TICKS_PER_SECOND;
  snapshot.buffs.berserk = buffs.berserkTicks / TICKS_PER_SECOND;
  snapshot.buffs.heal = buffs.healTicks / TICKS_PER_SECOND;
  snapshot.lifesteal = run.hero.gear.lifesteal;
  snapshot.faction = run.data.rules.factions[run.phaseFaction[run.phaseIndex]!]!.id;
  snapshot.slowed = run.hero.slowTicks / TICKS_PER_SECOND;
  snapshot.rooted = run.hero.rootTicks / TICKS_PER_SECOND;
  snapshot.phase = runPhase(run);
  const boss = latestBoss(run);
  if (boss < 0) {
    snapshot.boss = null;
  } else {
    // one object, filled in place while a boss lives
    const info = snapshot.boss ?? (snapshot.boss = { id: "", hp: 0, maxHp: 0, x: 0, y: 0 });
    info.id = run.data.enemies[enemies.type[boss]!]!.id;
    info.hp = enemies.hp[boss]!;
    info.maxHp = enemies.maxHp[boss]!;
    info.x = enemies.x[boss]!;
    info.y = enemies.y[boss]!;
  }
}
