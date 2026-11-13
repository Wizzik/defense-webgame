import { armorReduction, damageCastle, damageHero } from "./combat";
import { TICK_SECONDS, TICKS_PER_SECOND } from "./constants";
import { Slam, SlamEvent } from "./enemy-slam";
import { EventKind } from "./events";
import type { Run } from "./run";

/** After a strike lands, a slam waits at least this long: the hero gets a moment to answer. */
const SLAM_GAP_SECONDS = 2;

/** Out values of updateStrike: the velocity of this step (world units per second). */
export let strikeVX = 0;
export let strikeVY = 0;

/**
 * Runs the strike from afar of enemy i if its type has one. Returns true when the strike owns this step
 * (the caller skips the slam, the charge, targeting and the attack); writes strikeVX/strikeVY.
 *
 * None -> Strike: the enemy targets the hero in [minRange, maxRange] with the strike ready. A circle warns where
 * the hero stands and stays there. With `leap` the enemy travels to the centre of the circle during the windup,
 * otherwise it stands. After the windup the hero inside the circle and the castle the circle reaches take the
 * damage, and the cooldown starts. A stun or the death of the enemy cancels the warning (cancelSlam, killEnemy).
 * The windup lives in the slam fields of the store (state Slam.Strike), so the circle is drawn, dodged and
 * cancelled like a slam.
 */
export function updateStrike(run: Run, i: number, targetsHero: boolean, heroDist: number): boolean {
  const e = run.enemies;
  const strike = run.data.enemies[e.type[i]].strike;
  strikeVX = 0;
  strikeVY = 0;
  if (strike === undefined) return false;
  const { hero, castle } = run;

  if (e.slamState[i] === Slam.None) {
    if (!targetsHero || e.strikeCooldown[i] > 0 || heroDist < strike.minRange || heroDist > strike.maxRange) return false;
    e.slamState[i] = Slam.Strike;
    e.slamTicks[i] = Math.max(1, Math.round(strike.windupSeconds * TICKS_PER_SECOND));
    e.slamX[i] = hero.x;
    e.slamY[i] = hero.y;
    e.lastAttackTick[i] = run.tick;
    run.events.push(EventKind.Slam, i, SlamEvent.Warning, e.slamX[i], e.slamY[i], strike.radius, e.slamTicks[i]);
    return true;
  }
  if (e.slamState[i] !== Slam.Strike) return false;

  e.slamTicks[i]--;
  const cx = e.slamX[i];
  const cy = e.slamY[i];
  if (e.slamTicks[i] > 0) {
    if (strike.leap) {
      // arrives in the step before the hit, whatever pushed it on the way
      const seconds = e.slamTicks[i] * TICK_SECONDS;
      strikeVX = (cx - e.x[i]) / seconds;
      strikeVY = (cy - e.y[i]) / seconds;
    }
    return true;
  }
  const raw = strike.damage * e.damageScale[i];
  run.events.push(EventKind.Slam, i, SlamEvent.Hit, cx, cy, strike.radius, 0);
  const hx = hero.x - cx;
  const hy = hero.y - cy;
  if (hx * hx + hy * hy <= strike.radius * strike.radius) {
    damageHero(run, raw * (1 - armorReduction(hero.stats.armor, run.data.constants.defenseArmor)), i);
  }
  const wx = castle.x - cx;
  const wy = castle.y - cy;
  if (Math.sqrt(wx * wx + wy * wy) - castle.radius <= strike.radius) damageCastle(run, raw, i);
  endStrike(run, i);
  return true;
}

/** Ends a strike in its windup or after its hit: starts its cooldown and holds the slam back for a moment. */
export function endStrike(run: Run, i: number): void {
  const e = run.enemies;
  const strike = run.data.enemies[e.type[i]].strike;
  e.slamState[i] = Slam.None;
  e.slamTicks[i] = 0;
  e.strikeCooldown[i] = strike === undefined ? 0 : Math.round(strike.cooldownSeconds * TICKS_PER_SECOND);
  const gap = Math.round(SLAM_GAP_SECONDS * TICKS_PER_SECOND);
  if (e.slamCooldown[i] < gap) e.slamCooldown[i] = gap;
}
