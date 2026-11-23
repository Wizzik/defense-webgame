import type { Run } from "./run";

/**
 * An enemy keeps the hero it goes for until another living hero is nearer by more than this
 * (multiplayer migration step 3): two heroes side by side do not make a crowd flicker between them.
 */
export const TARGET_SWITCH_MARGIN = 100;

/** Squared distance of the last `nearestPlayer` answer (avoids allocating a pair). */
export let nearestSq = 0;

/**
 * The player whose hero stands nearest to (x, y): among the living heroes, or among all when every hero has fallen
 * (one player: always 0). A tie goes to the lower index. Leaves the squared distance in `nearestSq`.
 * With `targetable` only living heroes outside their co-op choice time count, and -1 means there is none.
 */
export function nearestPlayer(run: Run, x: number, y: number, targetable = false): number {
  const players = run.players;
  let best = -1;
  let bestSq = 0;
  let anyAlive = targetable;
  for (let p = 0; p < players.length; p++) if (players[p]!.hero.hp > 0) anyAlive = true;
  for (let p = 0; p < players.length; p++) {
    const hero = players[p]!.hero;
    if (anyAlive && hero.hp <= 0) continue;
    if (targetable && players[p]!.choosingTicks > 0) continue;
    const dx = hero.x - x;
    const dy = hero.y - y;
    const sq = dx * dx + dy * dy;
    if (best >= 0 && sq >= bestSq) continue;
    best = p;
    bestSq = sq;
  }
  nearestSq = bestSq;
  return best;
}

/**
 * The player enemy i goes for in this step, stored in `enemies.target`: the nearest living hero outside his co-op
 * choice time, but such a target stays until another one is nearer by more than TARGET_SWITCH_MARGIN; -1 when no
 * hero can be targeted (the enemy goes for the castle). One player: always 0.
 */
export function enemyTarget(run: Run, i: number): number {
  const e = run.enemies;
  if (run.players.length === 1) {
    e.target[i] = 0;
    return 0;
  }
  const x = e.x[i];
  const y = e.y[i];
  const nearest = nearestPlayer(run, x, y, true);
  const current = e.target[i];
  let target = nearest;
  const kept = current >= 0 ? run.players[current]! : null;
  if (nearest >= 0 && kept !== null && current !== nearest && kept.hero.hp > 0 && kept.choosingTicks === 0) {
    const hero = run.players[current]!.hero;
    const dx = hero.x - x;
    const dy = hero.y - y;
    const currentDist = Math.sqrt(dx * dx + dy * dy);
    if (Math.sqrt(nearestSq) + TARGET_SWITCH_MARGIN >= currentDist) target = current;
  }
  e.target[i] = target;
  return target;
}
