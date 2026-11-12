import { damageEnemy, stunEnemy } from "../combat";
import { applySlow } from "../enemies";
import type { Run } from "../run";

/**
 * Hits every live enemy whose centre is within radius + collision of (x, y) with spell damage (source 1, ref `index`).
 * Survivors get the stun (stunEnemy) and the slow. Returns the number of hits.
 */
export function hitEnemiesAround(
  run: Run, index: number, x: number, y: number, radius: number,
  damage: number, stunTicks: number, slow: number, slowTicks: number,
): number {
  const e = run.enemies;
  let hits = 0;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const reach = radius + run.data.enemies[e.type[i]].collision;
    const dx = e.x[i] - x;
    const dy = e.y[i] - y;
    if (dx * dx + dy * dy > reach * reach) continue;
    hits++;
    damageEnemy(run, i, damage, 1, index);
    if (e.alive[i] === 0) continue;
    stunEnemy(run, i, stunTicks);
    if (slowTicks > 0) applySlow(e, i, slow, slowTicks);
  }
  return hits;
}
