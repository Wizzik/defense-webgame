import { armorReduction, damageHero, rollDamage } from "./combat";
import { TICK_SECONDS, TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import type { Run } from "./run";

export const Charge = { None: 0, Windup: 1, Run: 2 } as const;

/** A charging enemy hits the hero when their circles are nearer than this. */
const TOUCH_MARGIN = 20;

/** Out values of updateCharge: the velocity of this step (world units per second). */
export let chargeVX = 0;
export let chargeVY = 0;

/**
 * Runs the charge of enemy i if its type has one. Returns true when the charge owns this step
 * (the caller skips targeting, steering and separation); writes chargeVX/chargeVY.
 * `walk` is the enemy's walking speed in this step, with slow and aura applied.
 *
 * None -> Windup: the enemy targets the hero in [minRange, maxRange] with the charge ready. It stands for
 * the windup, then locks the direction to the hero and runs along it at walk × speedMultiplier for at
 * most `distance`. Touching the hero deals the attack × damageMultiplier and ends the charge; so do the
 * end of the distance, a stun (cancelCharge) and the arena edge (the caller). Every end starts the cooldown.
 */
export function updateCharge(run: Run, i: number, targetsHero: boolean, heroDist: number, walk: number): boolean {
  const e = run.enemies;
  const def = run.data.enemies[e.type[i]];
  const charge = def.charge;
  if (charge === undefined) return false;
  const hero = run.hero;
  const state = e.chargeState[i];
  chargeVX = 0;
  chargeVY = 0;

  if (state === Charge.None) {
    if (!targetsHero || e.chargeCooldown[i] > 0 || heroDist < charge.minRange || heroDist > charge.maxRange) return false;
    e.chargeState[i] = Charge.Windup;
    e.chargeTicks[i] = Math.max(1, Math.round(charge.windupSeconds * TICKS_PER_SECOND));
    aimAtHero(run, i, heroDist);
    run.events.push(EventKind.EnemyCharge, i, 0, e.x[i], e.y[i], e.chargeDirX[i], e.chargeDirY[i]);
    return true;
  }

  if (state === Charge.Windup) {
    aimAtHero(run, i, heroDist);
    e.chargeTicks[i]--;
    if (e.chargeTicks[i] > 0) return true;
    // the direction is locked from here on
    e.chargeState[i] = Charge.Run;
    e.chargeTicks[i] = Math.ceil(charge.distance / (def.moveSpeed * charge.speedMultiplier * TICK_SECONDS));
    run.events.push(EventKind.EnemyCharge, i, 1, e.x[i], e.y[i], e.chargeDirX[i], e.chargeDirY[i]);
  }

  if (heroDist <= def.collision + hero.stats.collision + TOUCH_MARGIN) {
    const buff = e.buffed[i] === 1 && run.auraType >= 0 ? 1 + run.data.enemies[run.auraType].aura!.damage : 1;
    const raw = rollDamage(run.rng, def.attack.damageMin, def.attack.damageMax) * e.damageScale[i] * charge.damageMultiplier * buff;
    damageHero(run, raw * (1 - armorReduction(hero.stats.armor, run.data.constants.defenseArmor)), i);
    e.attackCooldown[i] = Math.round(def.attack.cooldown * TICKS_PER_SECOND);
    e.lastAttackTick[i] = run.tick;
    cancelCharge(run, i);
    return true;
  }
  const speed = walk * charge.speedMultiplier;
  chargeVX = e.chargeDirX[i] * speed;
  chargeVY = e.chargeDirY[i] * speed;
  e.chargeTicks[i]--;
  if (e.chargeTicks[i] <= 0) cancelCharge(run, i);
  return true;
}

/** Ends a charge in any state and starts its cooldown. Does nothing for an enemy that is not charging. */
export function cancelCharge(run: Run, i: number): void {
  const e = run.enemies;
  if (e.chargeState[i] === Charge.None) return;
  const charge = run.data.enemies[e.type[i]].charge;
  e.chargeState[i] = Charge.None;
  e.chargeTicks[i] = 0;
  e.chargeCooldown[i] = charge === undefined ? 0 : Math.round(charge.cooldownSeconds * TICKS_PER_SECOND);
}

function aimAtHero(run: Run, i: number, heroDist: number): void {
  const e = run.enemies;
  const ux = heroDist > 1e-6 ? (run.hero.x - e.x[i]) / heroDist : 1;
  const uy = heroDist > 1e-6 ? (run.hero.y - e.y[i]) / heroDist : 0;
  e.chargeDirX[i] = ux;
  e.chargeDirY[i] = uy;
  e.facingX[i] = ux;
  e.facingY[i] = uy;
}
