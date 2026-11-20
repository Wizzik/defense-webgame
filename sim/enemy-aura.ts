import type { Run } from "./run";

/** The grid holds the positions from the start of the step, which is when this runs: no margin needed. */
let candidates = new Int32Array(0);

/**
 * Marks `buffed` for every enemy near a living enemy with an aura (a captain, a warlord, the final boss). Called first in
 * updateEnemies, after the grid is built. `buffed` holds the type index + 1 of the carrier whose aura counts (0: none);
 * carriers of an aura are never buffed, and several carriers do not stack: the first in slot order wins.
 */
export function updateEnemyAuras(run: Run): void {
  const { enemies: e, grid, hasAura } = run;
  e.buffed.fill(0);
  if (candidates.length < e.capacity) candidates = new Int32Array(e.capacity);
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0 || hasAura[e.type[i]] === 0) continue;
    const type = e.type[i];
    const radius = run.data.enemies[type].aura!.radius;
    const found = grid.query(e.x[i], e.y[i], radius, candidates);
    for (let k = 0; k < found; k++) {
      const j = candidates[k];
      if (hasAura[e.type[j]] === 0 && e.buffed[j] === 0) e.buffed[j] = type + 1;
    }
  }
}

/** Damage multiplier of the aura on enemy `slot` (1 when it is not buffed). */
export function auraDamageScale(run: Run, slot: number): number {
  const carrier = run.enemies.buffed[slot];
  return carrier === 0 ? 1 : 1 + run.data.enemies[carrier - 1].aura!.damage;
}

/** Walking speed multiplier of the aura on enemy `slot` (1 when it is not buffed). */
export function auraSpeedScale(run: Run, slot: number): number {
  const carrier = run.enemies.buffed[slot];
  return carrier === 0 ? 1 : 1 + run.data.enemies[carrier - 1].aura!.moveSpeed;
}
