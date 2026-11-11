import type { Run } from "./run";

/** The grid holds the positions from the start of the step, which is when this runs: no margin needed. */
let candidates = new Int32Array(0);

/**
 * Marks `buffed` for every enemy near a living enemy with an aura (a captain). Called first in
 * updateEnemies, after the grid is built. Carriers of the aura are never buffed, and several
 * carriers do not stack: the mark is a flag.
 */
export function updateEnemyAuras(run: Run): void {
  const { enemies: e, grid } = run;
  e.buffed.fill(0);
  const auraType = run.auraType;
  if (auraType < 0) return;
  const radius = run.data.enemies[auraType].aura!.radius;
  if (candidates.length < e.capacity) candidates = new Int32Array(e.capacity);
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0 || e.type[i] !== auraType) continue;
    const found = grid.query(e.x[i], e.y[i], radius, candidates);
    for (let k = 0; k < found; k++) {
      const j = candidates[k];
      if (e.type[j] !== auraType) e.buffed[j] = 1;
    }
  }
}
