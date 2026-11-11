// Tests only: a quiet run (no spawns, no knockback) on a big arena with the castle far in a corner,
// and helpers to place enemies of a named type.
import type { GameData } from "../../data/schema";
import { EventKind } from "../events";
import { createRun } from "../run";
import { gameData } from "./game-data";
import { silenceSpawns } from "./silence";

export function enemyRun(tweak?: (data: GameData) => void) {
  const data = gameData();
  data.rules.arena = {
    width: 12000, height: 12000, castle: { x: -4000, y: -4000 }, heroStart: { x: 0, y: 0 },
    spawn: { radius: 1500, spread: 150 },
  };
  data.rules.castle = { hp: 1e9, radius: 180, regenPercentPerMinute: 0 };
  data.rules.hero.collision = 32;
  data.rules.enemies.siegerAggroRange = 250;
  data.rules.enemies.leashRange = 900;
  data.rules.enemies.knockback = { attack: 0, ability: 0, seconds: 0.15 };
  silenceSpawns(data);
  tweak?.(data);
  const run = createRun(data, { seed: 11, durationSeconds: 100000 });
  for (const slot of run.abilities) slot.level = 0;
  run.hero.stats.maxHp = 1e9;
  run.hero.hp = 1e9;
  return run;
}

export type EnemyRun = ReturnType<typeof enemyRun>;

export function typeOf(run: EnemyRun, id: string): number {
  const type = run.data.enemies.findIndex((e) => e.id === id);
  if (type < 0) throw new Error(`no enemy "${id}"`);
  return type;
}

/** An enemy of type `id` at (x, y) with a lot of hp. */
export function place(run: EnemyRun, id: string, role: number, x: number, y: number): number {
  return run.enemies.spawn(typeOf(run, id), role, x, y, 1e6, 1, 0);
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

export function heroDistance(run: EnemyRun, i: number): number {
  return distance(run.enemies.x[i]!, run.enemies.y[i]!, run.hero.x, run.hero.y);
}

/** Events of `kind` in the current step whose `a` is `slot` (any slot when omitted). */
export function countEvents(run: EnemyRun, kind: number, slot = -1): number {
  let n = 0;
  for (let k = 0; k < run.events.count; k++) {
    if (run.events.kind[k] === kind && (slot < 0 || run.events.a[k] === slot)) n++;
  }
  return n;
}

export const heroHits = (run: EnemyRun, slot = -1): number => countEvents(run, EventKind.HeroHit, slot);
