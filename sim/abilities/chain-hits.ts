import { damageEnemy } from "../combat";
import { EventKind } from "../events";
import type { Run } from "../run";

/**
 * A chain leaps from enemy `first` (struck at x, y) up to `jumps` times, each time to the nearest enemy within
 * `range` of the last one that the chain has not struck yet. Every leap sends a Blast (a = `ref`, value = `flash`,
 * x/y = the new target) and deals `damage` as a spell (`ref` names the spell slot, -1 for gear).
 * `hit` is the caller's scratch array with room for `jumps + 1` slots; it is overwritten. Returns the leaps made.
 */
export function chainJumps(
  run: Run, first: number, x: number, y: number, jumps: number, range: number, damage: number,
  hit: Int32Array, flash: number, ref = -1,
): number {
  const e = run.enemies;
  const rangeSq = range * range;
  hit[0] = first;
  let fromX = x;
  let fromY = y;
  for (let jump = 1; jump <= jumps; jump++) {
    let best = -1;
    let bestSq = rangeSq;
    for (let i = 0; i < e.capacity; i++) {
      if (e.alive[i] === 0) continue;
      let seen = false;
      for (let h = 0; h < jump; h++) {
        if (hit[h] === i) {
          seen = true;
          break;
        }
      }
      if (seen) continue;
      const dx = e.x[i]! - fromX;
      const dy = e.y[i]! - fromY;
      const sq = dx * dx + dy * dy;
      if (sq <= bestSq) {
        bestSq = sq;
        best = i;
      }
    }
    if (best < 0) return jump - 1;
    hit[jump] = best;
    fromX = e.x[best]!;
    fromY = e.y[best]!;
    run.events.push(EventKind.Blast, ref, flash, fromX, fromY, 0, 0);
    damageEnemy(run, best, damage, 1, ref);
  }
  return jumps;
}
