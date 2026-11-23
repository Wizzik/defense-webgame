import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import type { Run } from "./run";

/**
 * Co-op only (multiplayer migration step 6, Petr's rule R6): a fallen hero is revived when a living teammate stands
 * within `rules.coop.revive.radius` of him for `revive.seconds` without a break; he stands up where he lies at
 * `revive.hpShare` of his max hp. The progress resets as soon as nobody is near. The nearest living teammate within
 * reach is named as the reviver. A teammate in his choice time counts (he can walk while choosing).
 */
export function updateRevive(run: Run): void {
  const { players } = run;
  if (players.length < 2) return;
  const { revive } = run.data.rules.coop;
  const reachSq = revive.radius * revive.radius;
  const needed = Math.round(revive.seconds * TICKS_PER_SECOND);
  for (let p = 0; p < players.length; p++) {
    const fallen = players[p]!;
    const hero = fallen.hero;
    if (hero.hp > 0) {
      fallen.reviveTicks = 0;
      continue;
    }
    let reviver = -1;
    let best = reachSq;
    for (let q = 0; q < players.length; q++) {
      if (q === p) continue;
      const mate = players[q]!.hero;
      if (mate.hp <= 0) continue;
      const dx = mate.x - hero.x;
      const dy = mate.y - hero.y;
      const sq = dx * dx + dy * dy;
      if (sq <= best) {
        best = sq;
        reviver = q;
      }
    }
    if (reviver < 0) {
      fallen.reviveTicks = 0;
      continue;
    }
    fallen.reviveTicks++;
    if (fallen.reviveTicks < needed) continue;
    fallen.reviveTicks = 0;
    hero.hp = hero.stats.maxHp * revive.hpShare;
    run.events.push(EventKind.Revive, p, hero.hp, hero.x, hero.y, reviver, 0);
  }
}

/** Seconds of revive progress of player `p` (0 while he lives or nobody is near), for the HUD. */
export function reviveShare(run: Run, p: number): number {
  const needed = Math.round(run.data.rules.coop.revive.seconds * TICKS_PER_SECOND);
  return run.players[p]!.reviveTicks / needed;
}
