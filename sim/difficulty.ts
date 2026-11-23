import { DIFFICULTY_IDS, type DifficultyId, type GameData, type Rules } from "../data/schema";
import type { Run } from "./run";

/** Multipliers of one world, difficulty and player count (spec 2026-11-21 4.2, rules.coop), computed once when the run is created. */
export interface DifficultyMods {
  hp: number;
  damage: number;
  packSize: number;
  /** Elites and bosses: on top of `hp`. */
  eliteHp: number;
  gold: number;
  /** Added to the hero's magic find from gear. */
  magicFind: number;
}

export function difficultyMods(rules: Rules, world: number, difficulty: DifficultyId, players = 1): DifficultyMods {
  const { worldStep, reward, levels } = rules.difficulty;
  const level = levels[difficulty];
  const above = world - 1;
  // co-op (multiplayer migration step 6): every player after the first adds rules.coop.perPlayer; one player x 1
  const more = players - 1;
  const per = rules.coop.perPlayer;
  return {
    hp: level.hp * (1 + worldStep.hp * above) * (1 + per.hp * more),
    damage: level.damage * (1 + worldStep.damage * above) * (1 + per.damage * more),
    packSize: level.packSize * (1 + per.packSize * more),
    eliteHp: level.eliteHp * (1 + per.eliteHp * more),
    gold: 1 + reward.goldPerWorld * above,
    magicFind: reward.magicFindPerWorld * above + level.magicFind,
  };
}

/** Checks `RunOptions.world` and `RunOptions.difficulty`; throws an Error naming the field. */
export function checkCourse(data: GameData, world: number, difficulty: string): DifficultyId {
  if (!Number.isInteger(world) || world < 1 || world > data.worlds.length) {
    throw new Error(`createRun: world must be a whole number from 1 to ${data.worlds.length}, got ${world}`);
  }
  if (!(DIFFICULTY_IDS as readonly string[]).includes(difficulty)) {
    throw new Error(`createRun: unknown difficulty "${difficulty}"`);
  }
  return difficulty as DifficultyId;
}

/** Hp of a new enemy of `type`: its base hp x time x the run's multipliers (elites and bosses x eliteHp). */
export function enemyHp(run: Run, type: number, timeScale: number): number {
  const mods = run.mods;
  const strong = run.isElite[type] === 1 || run.isBoss[type] === 1;
  return run.data.enemies[type]!.hp * timeScale * mods.hp * (strong ? mods.eliteHp : 1);
}

/** Damage multiplier of a new enemy. */
export function enemyDamageScale(run: Run, timeScale: number): number {
  return timeScale * run.mods.damage;
}

/** Magic find of chest rolls: gear plus the world's and difficulty's bonus. */
export function runMagicFind(run: Run): number {
  return run.hero.gear.magicFind + run.mods.magicFind;
}
