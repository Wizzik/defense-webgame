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
