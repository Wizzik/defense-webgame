import type { Meteors } from "../data/schema";
import { berserkScale } from "./buffs";
import { damageEnemy, damageHero, heroDamageScale, HeroHitSource } from "./combat";
import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import type { Run } from "./run";

/** Pools of fire that can burn at once per player (a wave has at most `bolts.max` meteors around each hero). */
export const POOL_CAPACITY = 8;
/** Pools burn every POOL_PULSE steps (3 times a second), a third of their share a second each time. */
export const POOL_PULSE = 10;
const PULSES_PER_SECOND = TICKS_PER_SECOND / POOL_PULSE;

/** The world's meteors (spec 2026-11-21 difficulties 4.7 point 5), or null. */
export function meteorsOf(run: Run): Meteors | null {
  const h = run.data.worlds[run.world - 1]!.hazard;
  return h.kind === "meteors" ? h : null;
}

/** A meteor struck (x, y): a pool of green fire burns there for pool.seconds; a full list overwrites the oldest pool. */
export function addPool(run: Run, x: number, y: number): void {
  const m = meteorsOf(run);
  if (m === null) return;
  const h = run.hazard;
  let slot = 0;
  for (let i = 1; i < h.poolTicks.length; i++) if (h.poolTicks[i]! < h.poolTicks[slot]!) slot = i;
  const ticks = Math.round(m.pool.seconds * TICKS_PER_SECOND);
  h.poolX[slot] = x;
  h.poolY[slot] = y;
  h.poolTicks[slot] = ticks;
  h.pools++;
  run.events.push(EventKind.Hazard, slot, 2, x, y, m.pool.radius, ticks);
}

/**
 * Once per step, from updateHazard before the strikes: counts the pools down and, every POOL_PULSE steps, burns every
 * hero (damageHero: not a fallen or choosing co-op hero, not through the spirit shield; the exact share, no armor) and
 * every enemy whose centre is inside a pool, each by at most one pool a pulse. The castle is spared.
 */
export function updatePools(run: Run): void {
  const m = meteorsOf(run);
  if (m === null) return;
  const h = run.hazard;
  let live = false;
  for (let i = 0; i < h.poolTicks.length; i++) {
    if (h.poolTicks[i] === 0) continue;
    h.poolTicks[i]--;
    if (h.poolTicks[i]! > 0) live = true;
  }
  if (!live || run.tick % POOL_PULSE !== 0) return;
  for (let p = 0; p < run.players.length; p++) {
    run.current = p;
    const hero = run.hero;
    if (hero.hp <= 0 || poolAt(run, hero.x, hero.y, 0) < 0) continue;
    damageHero(run, (m.pool.heroSharePerSecond / PULSES_PER_SECOND) * hero.stats.maxHp / heroDamageScale(run), -1, HeroHitSource.Fire);
  }
  run.current = 0;
  const e = run.enemies;
  const scale = 1 / berserkScale(run);
  for (let s = 0; s < e.capacity; s++) {
    if (e.alive[s] === 0 || poolAt(run, e.x[s]!, e.y[s]!, 0) < 0) continue;
    const share = run.isBoss[e.type[s]!] === 1 ? m.pool.bossSharePerSecond : m.pool.enemySharePerSecond;
    damageEnemy(run, s, (e.maxHp[s]! * share * scale) / PULSES_PER_SECOND, 2);
  }
}

/** The first burning pool that touches the circle (x, y, r), or -1. */
export function poolAt(run: Run, x: number, y: number, r: number): number {
  const m = meteorsOf(run);
  if (m === null) return -1;
  const h = run.hazard;
  const reach = m.pool.radius + r;
  for (let i = 0; i < h.poolTicks.length; i++) {
    if (h.poolTicks[i] === 0) continue;
    const dx = x - h.poolX[i]!;
    const dy = y - h.poolY[i]!;
    if (dx * dx + dy * dy < reach * reach) return i;
  }
  return -1;
}
