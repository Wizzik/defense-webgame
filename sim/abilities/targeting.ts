import type { Run } from "../run";

/** Nearest live enemy whose centre is at most `range` from (x, y); -1 when none. Ties go to the lower slot. */
export function nearestEnemy(run: Run, x: number, y: number, range: number): number {
  const e = run.enemies;
  const maxSq = range * range;
  let best = -1;
  let bestSq = 0;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const dx = e.x[i] - x;
    const dy = e.y[i] - y;
    const sq = dx * dx + dy * dy;
    if (sq > maxSq || (best >= 0 && sq >= bestSq)) continue;
    best = i;
    bestSq = sq;
  }
  return best;
}

/** Number of live enemies whose centre is at most `radius + collision` from (x, y). */
export function countEnemiesWithin(run: Run, x: number, y: number, radius: number): number {
  const e = run.enemies;
  let count = 0;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const reach = radius + run.data.enemies[e.type[i]].collision;
    const dx = e.x[i] - x;
    const dy = e.y[i] - y;
    if (dx * dx + dy * dy <= reach * reach) count++;
  }
  return count;
}

/**
 * Among enemies within `range` of (x, y), the one with the most enemies within `radius` around it.
 * Ties: closer to (x, y), then the lower slot. O(n^2); runs only when a spell is cast.
 */
export function densestCluster(run: Run, x: number, y: number, range: number, radius: number): number {
  const e = run.enemies;
  const maxSq = range * range;
  let best = -1;
  let bestCount = 0;
  let bestSq = 0;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const dx = e.x[i] - x;
    const dy = e.y[i] - y;
    const sq = dx * dx + dy * dy;
    if (sq > maxSq) continue;
    const count = countEnemiesWithin(run, e.x[i], e.y[i], radius);
    if (best < 0 || count > bestCount || (count === bestCount && sq < bestSq)) {
      best = i;
      bestCount = count;
      bestSq = sq;
    }
  }
  return best;
}

/**
 * The enemy within `length` of (x, y) whose direction from (x, y) aims a line of `length` and half width `halfWidth`
 * through the most enemies (each counted with its collision, as the line hits); ties: closer, then the lower slot
 * (Petr, batch 2: five enemies side by side beat one alone). O(n^2); runs only when a line spell is cast.
 */
export function densestLine(run: Run, x: number, y: number, length: number, halfWidth: number): number {
  const e = run.enemies;
  const types = run.data.enemies;
  const maxSq = length * length;
  let best = -1;
  let bestCount = 0;
  let bestSq = 0;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const dx = e.x[i] - x;
    const dy = e.y[i] - y;
    const sq = dx * dx + dy * dy;
    if (sq > maxSq || sq < 1e-9) continue;
    const d = Math.sqrt(sq);
    const ux = dx / d;
    const uy = dy / d;
    let count = 0;
    for (let j = 0; j < e.capacity; j++) {
      if (e.alive[j] === 0) continue;
      const rx = e.x[j] - x;
      const ry = e.y[j] - y;
      const c = types[e.type[j]].collision;
      const t = rx * ux + ry * uy;
      if (t < -c || t - c > length) continue;
      const cross = rx * uy - ry * ux;
      if ((cross < 0 ? -cross : cross) <= halfWidth + c) count++;
    }
    if (best < 0 || count > bestCount || (count === bestCount && sq < bestSq)) {
      best = i;
      bestCount = count;
      bestSq = sq;
    }
  }
  return best;
}

/**
 * The strongest live enemy whose centre is at most `range` from (x, y): a boss or an elite (a hunter type) comes
 * first; among them, or among all when none is in range, the one with the most hp. Ties go to the lower slot.
 */
export function strongestEnemy(run: Run, x: number, y: number, range: number): number {
  const e = run.enemies;
  const types = run.data.enemies;
  const maxSq = range * range;
  let best = -1;
  let bestElite = false;
  let bestHp = 0;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const dx = e.x[i] - x;
    const dy = e.y[i] - y;
    if (dx * dx + dy * dy > maxSq) continue;
    const type = types[e.type[i]];
    const elite = type.boss === true || type.hunter === true;
    const hp = e.hp[i];
    if (best >= 0 && (bestElite && !elite || (bestElite === elite && hp <= bestHp))) continue;
    best = i;
    bestElite = elite;
    bestHp = hp;
  }
  return best;
}
