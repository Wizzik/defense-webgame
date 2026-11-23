import type { Rules } from "../data/schema";
import { auraBonuses } from "./abilities/aura";
import { passiveBonuses } from "./abilities/passive";
import { EventKind } from "./events";
import { heroStats } from "./hero";
import type { Run } from "./run";

/** XP needed to leave `level`: xpFirst + xpStep * (level - 1). */
export function xpToNext(rules: Rules, level: number): number {
  return rules.progression.xpFirst + rules.progression.xpStep * (level - 1);
}

/** Recomputes the hero stats from the attributes and the learned auras; a living hero's hp grows by the gain in maxHp (the dead stay dead). */
export function refreshHeroStats(run: Run): void {
  const { hero, data } = run;
  const before = hero.stats.maxHp;
  auraBonuses(run, hero.bonus);
  passiveBonuses(run, hero.passive);
  heroStats(data, hero, hero.stats);
  if (hero.hp > 0) hero.hp += hero.stats.maxHp - before;
}

/**
 * Adds XP to the shared pool (multiplayer migration step 4): every player's hero gains it, so all heroes level
 * together; every threshold crossed is a level-up of each hero with per-level attribute growth. Counted once in
 * the run's stats. Leaves `run.current` as it found it.
 */
export function gainXp(run: Run, amount: number): void {
  run.stats.xpGained += amount;
  const current = run.current;
  for (let p = 0; p < run.players.length; p++) {
    run.current = p;
    heroGainXp(run, amount);
  }
  run.current = current;
}

function heroGainXp(run: Run, amount: number): void {
  const { hero, data } = run;
  hero.xp += amount;
  let leveled = false;
  while (hero.xp >= xpToNext(data.rules, hero.level)) {
    hero.xp -= xpToNext(data.rules, hero.level);
    hero.level++;
    const a = hero.def.attributes;
    hero.str += a.str.perLevel;
    hero.agi += a.agi.perLevel;
    hero.int += a.int.perLevel;
    hero.pendingLevelUps++;
    leveled = true;
    run.events.push(EventKind.LevelUp, hero.level, 0, hero.x, hero.y, 0, run.current);
  }
  if (leveled) refreshHeroStats(run);
}

/** Same as gainXp; for end-to-end tests and debugging only. */
export function debugGrantXp(run: Run, amount: number): void {
  gainXp(run, amount);
}
