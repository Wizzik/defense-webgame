import { armorReduction, damageEnemy, rollDamage, stunEnemy } from "./combat";
import type { Run } from "./run";

/** The most extra targets one attack can take; data above it is clamped. */
export const MAX_EXTRA_TARGETS = 8;

const picked = new Int32Array(MAX_EXTRA_TARGETS);
const pickedSq = new Float64Array(MAX_EXTRA_TARGETS);

/**
 * Multishot: after the base attack on `main`, shoots up to `count` other enemies in attack reach, nearest first
 * (equal distance: lower slot). Each split shot rolls its own base damage, adds the on_hit `bonus` the main shot
 * got (no new chance roll, no Cast event) and is reduced by its target's armor; it carries the stun of the main
 * shot (Petr 2026-11-19: every arrow gets the bonus). Empower and gear effects stay with the main shot.
 * All targets are picked before the first extra shot lands. No allocation.
 */
export function hitExtraTargets(run: Run, main: number, count: number, stunTicks: number, bonus: number): void {
  const { hero, enemies: e, data } = run;
  const n = count < MAX_EXTRA_TARGETS ? count : MAX_EXTRA_TARGETS;
  if (n <= 0) return;
  const range = hero.def.baseAttack.range;
  let found = 0;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0 || i === main) continue;
    const reach = hero.stats.collision + data.enemies[e.type[i]].collision + range;
    const dx = e.x[i] - hero.x;
    const dy = e.y[i] - hero.y;
    const sq = dx * dx + dy * dy;
    if (sq > reach * reach) continue;
    if (found === n && sq >= pickedSq[n - 1]) continue;
    let k = found < n ? found++ : n - 1;
    while (k > 0 && pickedSq[k - 1] > sq) {
      picked[k] = picked[k - 1];
      pickedSq[k] = pickedSq[k - 1];
      k--;
    }
    picked[k] = i;
    pickedSq[k] = sq;
  }
  const stats = hero.stats;
  for (let k = 0; k < found; k++) {
    const slot = picked[k];
    if (e.alive[slot] === 0) continue;
    const reduction = armorReduction(data.enemies[e.type[slot]].armor, data.constants.defenseArmor);
    const amount = (rollDamage(run.rng, stats.damageMin, stats.damageMax) + bonus) * (1 - reduction);
    damageEnemy(run, slot, amount, 0);
    if (e.alive[slot] === 1) stunEnemy(run, slot, stunTicks);
  }
}
