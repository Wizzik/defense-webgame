import { applySlow } from "../enemies";
import type { Run } from "../run";
import type { AbilitySlot } from "./slots";

/** The slow is applied again every this many steps and lasts a little longer, so it never lapses in between. */
export const AURA_SLOW_PERIOD = 10;
const AURA_SLOW_TICKS = AURA_SLOW_PERIOD + 5;

/** Scratch list of the enemies the grid finds; it grows only when the enemy store is larger than ever before. */
let near = new Int32Array(0);

/**
 * An aura with `slow` and `radius` (the Frostweaver's Chill Field): every AURA_SLOW_PERIOD steps the living enemies
 * within `radius` of the living hero walk `slow` slower, like the gear's slow aura (a larger slow wins). The grid
 * holds the enemies as updateEnemies placed them in this step. Auras without `slow` do nothing here (their bonuses
 * come from auraBonuses). Draws nothing from the rng.
 */
export function updateAura(run: Run, slot: AbilitySlot): void {
  const def = slot.def;
  if (def.kind !== "aura" || slot.level < 1 || def.params.slow === undefined || def.params.radius === undefined) return;
  const hero = run.hero;
  if (hero.hp <= 0 || run.tick % AURA_SLOW_PERIOD !== 0) return;
  const e = run.enemies;
  if (near.length < e.capacity) near = new Int32Array(e.capacity);
  const L = slot.level - 1;
  const slow = def.params.slow[L]!;
  const found = run.grid.query(hero.x, hero.y, def.params.radius[L]!, near);
  for (let k = 0; k < found; k++) {
    const i = near[k]!;
    if (e.alive[i] === 1) applySlow(e, i, slow, AURA_SLOW_TICKS);
  }
}
