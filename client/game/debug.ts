import type { GearSession } from "./gear-session";
import { chestPrice, debugGrantGold, debugGrantXp, debugSetAbilityLevel, debugSpawnEach, killEnemy, type Run } from "../../sim";
import { latestBoss, runPhase } from "./boss";
import type { Backend, GpuInfo } from "../render/gpu";

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
  abilityLevels: number[];
  /** Ticks left per slot. */
  abilityCooldowns: number[];
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
  /** What the renderer built: `heroModels` is how many hero figures stand in the scene (refreshed every frame), `slamRings` how many slam circles lie on the floor. */
  render: { enemyMeshes: number; heroModels: number; shadows: boolean; slamRings: number };
  /** Gold the hero holds. */
  gold: number;
  /** Gold the next chest costs. */
  chestPrice: number;
  /** The chests on the map, in simulation coordinates. */
  chests: { x: number; y: number }[];
  chestsOpened: number;
  /** The 16 gear slots in the order of `SLOT_IDS`: item id and levels, or null for an empty slot. */
  gear: ({ item: string; base: number; temp: number } | null)[];
  /** The player's collection: item id to its permanent level. */
  collection: Record<string, number>;
  /** Whether the gear is stored in this browser (false with ?debug=1 and without storage). */
  gearSaved: boolean;
  /** Only with ?debug=1. */
  debug?: {
    grantXp(amount: number): void;
    grantGold(amount: number): void;
    /** Puts an item into the collection at a permanent level. */
    grantItem(id: string, level: number): void;
    /** Empties the collection and the dolls. */
    clearGear(): void;
    setAbilityLevel(slot: number, level: number): void;
    /** One hunter of every common enemy type, in a row north of the hero. */
    spawnEach(): void;
    /** Moves the hero to simulation coordinates, clamped to the arena. */
    teleport(x: number, y: number): void;
    /** Kills every living boss; the fall of the final boss wins the run in the next step. */
    killBoss(): void;
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
    hero: "", heroX: 0, heroY: 0, abilityLevels: [], abilityCooldowns: [], ultimateAuto: true, allies: 0,
    projectiles: 0, packArrows: 0, charging: 0, phase: 1, boss: null, slams: 0,
    render: { enemyMeshes: 0, heroModels: 0, shadows: false, slamRings: 0 },
    gold: 0, chestPrice: 0, chests: [], chestsOpened: 0, gear: [], collection: {}, gearSaved: false,
  };
  window.__game = snapshot;
  return snapshot;
}

/** Adds `window.__game.debug`; `getRun` is read at call time because the run is replaced on every start. */
/** `deliver` hands the run's events to the views, as the session does after a step. */
export function addDebugHooks(
  snapshot: GameSnapshot, getRun: () => Run | null, gear: GearSession, deliver: (run: Run) => void,
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
    spawnEach(): void {
      const run = getRun();
      if (run) debugSpawnEach(run);
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
  snapshot.heroX = run.hero.x;
  snapshot.heroY = run.hero.y;
  // the slot count is fixed (4), so these arrays are filled in place after the first frame
  const { abilities } = run;
  snapshot.abilityLevels.length = abilities.length;
  snapshot.abilityCooldowns.length = abilities.length;
  for (let i = 0; i < abilities.length; i++) {
    snapshot.abilityLevels[i] = abilities[i]!.level;
    snapshot.abilityCooldowns[i] = abilities[i]!.cooldown;
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
