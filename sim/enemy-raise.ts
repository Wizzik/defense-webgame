import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import { EventKind } from "./events";
import type { Run } from "./run";
import { spawnAt } from "./spawner";

/**
 * The gravebinder raises the fallen (spec 2026-11-20, 4.5). Every gravebinder whose cooldown is over (and that is not
 * stunned) raises up to `count` enemies of `raise.type` at the nearest remembered deaths within `range` that are
 * younger than `maxAgeSeconds`; each used place is gone. A raise needs a free slot: it never pushes anyone out, and a
 * full store keeps the places. The cooldown starts only when at least one rose. Called in updateEnemies after the
 * bloodlust; the risen act in the same step. Does not allocate.
 */
export function updateRaise(run: Run): void {
  const e = run.enemies;
  const defs = run.data.enemies;
  for (let i = 0; i < e.capacity; i++) {
    if (e.alive[i] === 0) continue;
    const raise = defs[e.type[i]].raise;
    if (raise === undefined) continue;
    if (e.raiseCooldown[i] > 0) e.raiseCooldown[i]--;
    if (e.raiseCooldown[i] > 0 || e.stunTicks[i] > 0) continue;
    const minTick = run.tick - Math.round(raise.maxAgeSeconds * TICKS_PER_SECOND);
    let raised = 0;
    for (let k = 0; k < raise.count; k++) {
      if (e.aliveCount >= e.capacity) break;
      const place = run.corpses.take(e.x[i], e.y[i], raise.range, minTick);
      if (place < 0) break;
      const x = run.corpses.x[place];
      const y = run.corpses.y[place];
      const slot = spawnAt(run, run.raiseTypes[e.type[i]], Role.Sieger, x, y);
      if (slot < 0) break;
      raised++;
      run.stats.raised++;
      run.events.push(EventKind.Raise, slot, e.type[i], x, y, 0, 0);
    }
    if (raised > 0) e.raiseCooldown[i] = Math.round(raise.cooldownSeconds * TICKS_PER_SECOND);
  }
}
