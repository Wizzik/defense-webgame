import { damageHero } from "./combat";
import { TICKS_PER_SECOND } from "./constants";
import type { Run } from "./run";

/**
 * Poison clouds (spec 2026-11-20, 4.4): a hero inside the cloud of at least one living enemy loses
 * `hpSharePerSecond` x max hp a second (x the hero's damage scale, like every enemy hit; armor does not count, the
 * Spirit Ward shield does). Several clouds do not add up: the strongest share counts. The castle is never hurt.
 * Runs right after updateEnemies, on the positions it left. Does not allocate.
 */
export function updateClouds(run: Run): void {
  const { hero, enemies: e } = run;
  if (hero.hp <= 0) return;
  const defs = run.data.enemies;
  let share = 0;
  let source = -1;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const cloud = defs[e.type[i]].cloud;
    if (cloud === undefined || cloud.hpSharePerSecond <= share) continue;
    const dx = hero.x - e.x[i];
    const dy = hero.y - e.y[i];
    if (dx * dx + dy * dy > cloud.radius * cloud.radius) continue;
    share = cloud.hpSharePerSecond;
    source = i;
  }
  if (source < 0) return;
  run.stats.cloudDamage += damageHero(run, (share * hero.stats.maxHp) / TICKS_PER_SECOND, source);
}
