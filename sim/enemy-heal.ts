import { TICKS_PER_SECOND } from "./constants";
import { Action } from "./enemies";
import { EventKind } from "./events";
import type { Run } from "./run";

/** The grid holds the positions from the start of the step; this margin covers one step of movement. */
const GRID_MARGIN = 64;

/** Candidate buffer; it grows only when a run has a bigger enemy store. */
let candidates = new Int32Array(0);

/**
 * Enemies with a heal (chaplains) heal the most wounded living enemy within range, themselves
 * included; the lowest slot wins a tie. Runs right after `updateEnemies`, whose grid it reads.
 * A stunned healer does nothing, and a healer with no wounded target keeps its heal ready.
 */
export function healEnemies(run: Run): void {
  const { enemies: e, grid } = run;
  const defs = run.data.enemies;
  if (candidates.length < e.capacity) candidates = new Int32Array(e.capacity);
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const heal = defs[e.type[i]].heal;
    if (heal === undefined) continue;
    if (e.stunTicks[i] > 0 || e.action[i] === Action.Stunned) continue;
    if (e.healCooldown[i] > 0) {
      e.healCooldown[i]--;
      continue;
    }
    const x = e.x[i];
    const y = e.y[i];
    const rangeSq = heal.range * heal.range;
    const found = grid.query(x, y, heal.range + GRID_MARGIN, candidates);
    let target = -1;
    let worst = 0;
    for (let k = 0; k < found; k++) {
      const j = candidates[k];
      if (e.alive[j] === 0) continue;
      const lost = e.maxHp[j] - e.hp[j];
      if (lost <= 0 || lost < worst || (lost === worst && j > target)) continue;
      const dx = e.x[j] - x;
      const dy = e.y[j] - y;
      if (dx * dx + dy * dy > rangeSq) continue;
      target = j;
      worst = lost;
    }
    if (target < 0) continue;
    const amount = Math.min(heal.amount * e.damageScale[i], worst);
    e.hp[target] += amount;
    run.events.push(EventKind.EnemyHeal, target, amount, e.x[target], e.y[target], i, 0);
    e.healCooldown[i] = Math.round(heal.cooldown * TICKS_PER_SECOND);
  }
}
