import type { Run } from "../../sim";

/** Slot of the living boss that came last (the higher slot on a tie); -1 without a living boss. Does not allocate. */
export function latestBoss(run: Run): number {
  if (run.bossCount <= 0) return -1;
  const { enemies } = run;
  let best = -1;
  for (let i = 0; i < enemies.capacity; i++) {
    if (enemies.alive[i] === 0 || run.isBoss[enemies.type[i]!] === 0) continue;
    if (best < 0 || enemies.spawnTick[i]! >= enemies.spawnTick[best]!) best = i;
  }
  return best;
}

/** Phase of the run counted from 1; the finale is one past the last phase. */
export function runPhase(run: Run): number {
  return run.inFinale ? run.data.rules.phases.length + 1 : run.phaseIndex + 1;
}
