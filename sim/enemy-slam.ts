import { armorReduction, damageCastle, damageHero } from "./combat";
import { TICKS_PER_SECOND } from "./constants";
import { endStrike } from "./enemy-strike";
import { EventKind } from "./events";
import type { Run } from "./run";

/** Windup: a slam around the enemy. Strike: a strike from afar (sim/enemy-strike.ts), a circle on the hero. */
export const Slam = { None: 0, Windup: 1, Strike: 2 } as const;
/** `value` of a Slam event. */
export const SlamEvent = { Warning: 0, Hit: 1, Cancelled: 2 } as const;

/** A slam starts when the hero or the castle wall is within this share of its radius. */
const START_SHARE = 0.8;

/**
 * Runs the slam of enemy i if its type has one. Returns true when the slam owns this step: the enemy stands
 * and the caller skips the charge, targeting and the attack.
 *
 * None -> Windup: the slam is ready and the hero or the castle is near. The circle stays where the enemy
 * stood. After the windup the hero inside the circle and the castle the circle reaches take the damage
 * (allies do not), and a random cooldown starts. A stun cancels the windup (cancelSlam).
 */
export function updateSlam(run: Run, i: number, heroDist: number): boolean {
  const e = run.enemies;
  const slam = run.data.enemies[e.type[i]].slam;
  if (slam === undefined || e.slamState[i] === Slam.Strike) return false;
  const { hero, castle } = run;

  if (e.slamState[i] === Slam.None) {
    if (e.slamCooldown[i] > 0) return false;
    const near = slam.radius * START_SHARE;
    if (heroDist > near && wallDistance(run, e.x[i], e.y[i]) > near) return false;
    e.slamState[i] = Slam.Windup;
    e.slamTicks[i] = Math.max(1, Math.round(slam.windupSeconds * TICKS_PER_SECOND));
    e.slamX[i] = e.x[i];
    e.slamY[i] = e.y[i];
    e.lastAttackTick[i] = run.tick;
    run.events.push(EventKind.Slam, i, SlamEvent.Warning, e.slamX[i], e.slamY[i], slam.radius, e.slamTicks[i]);
    return true;
  }

  e.slamTicks[i]--;
  if (e.slamTicks[i] > 0) return true;
  const cx = e.slamX[i];
  const cy = e.slamY[i];
  const raw = slam.damage * e.damageScale[i];
  run.events.push(EventKind.Slam, i, SlamEvent.Hit, cx, cy, slam.radius, 0);
  const hx = hero.x - cx;
  const hy = hero.y - cy;
  if (hx * hx + hy * hy <= slam.radius * slam.radius) {
    damageHero(run, raw * (1 - armorReduction(hero.stats.armor, run.data.constants.defenseArmor)), i);
  }
  if (wallDistance(run, cx, cy) <= slam.radius) damageCastle(run, raw, i);
  endSlam(run, i);
  return true;
}

/** Ends the windup of a slam or of a strike from afar without a hit and starts its cooldown. Does nothing for an enemy that is not winding up. */
export function cancelSlam(run: Run, i: number): void {
  const e = run.enemies;
  if (e.slamState[i] === Slam.None) return;
  run.events.push(EventKind.Slam, i, SlamEvent.Cancelled, e.slamX[i], e.slamY[i], windupRadius(run, i), 0);
  if (e.slamState[i] === Slam.Strike) endStrike(run, i);
  else endSlam(run, i);
}

/** Radius of the warning circle enemy i is winding up (a slam or a strike from afar); 0 when there is none. */
export function windupRadius(run: Run, i: number): number {
  const e = run.enemies;
  const def = run.data.enemies[e.type[i]];
  if (e.slamState[i] === Slam.Strike) return def.strike === undefined ? 0 : def.strike.radius;
  if (e.slamState[i] === Slam.Windup) return def.slam === undefined ? 0 : def.slam.radius;
  return 0;
}

/** Draws the next cooldown: exactly one rng value per ended slam. */
function endSlam(run: Run, i: number): void {
  const e = run.enemies;
  const slam = run.data.enemies[e.type[i]].slam;
  e.slamState[i] = Slam.None;
  e.slamTicks[i] = 0;
  if (slam === undefined) return;
  const [min, max] = slam.cooldownSeconds;
  e.slamCooldown[i] = Math.round((min + run.rng.next() * (max - min)) * TICKS_PER_SECOND * run.slamCooldownScale);
}

/** Distance from (x, y) to the wall of the castle (negative inside). */
function wallDistance(run: Run, x: number, y: number): number {
  const dx = run.castle.x - x;
  const dy = run.castle.y - y;
  return Math.sqrt(dx * dx + dy * dy) - run.castle.radius;
}
