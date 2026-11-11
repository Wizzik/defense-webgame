import { TICKS_PER_SECOND } from "../constants";
import type { Run } from "../run";
import { startCast } from "./slots";

/**
 * Called by updateHeroCombat when the hero attacks at (x, y). The first charged on_hit slot returns 1 + empower[L],
 * discharges and casts (Cast value = the multiplier). Without a charged slot it returns 1.
 */
export function consumeEmpower(run: Run, x: number, y: number): number {
  for (let i = 0; i < run.abilities.length; i++) {
    const slot = run.abilities[i];
    const def = slot.def;
    if (def.kind !== "on_hit" || !slot.active || slot.level < 1 || def.params.empower === undefined) continue;
    const multiplier = 1 + (def.params.empower?.[slot.level - 1] ?? 0);
    slot.active = false;
    startCast(run, i, multiplier, x, y, 0, 0);
    return multiplier;
  }
  return 1;
}

/** Second result of onHitBonus: steps the attacked enemy is stunned for (0: none). */
export let onHitStunTicks = 0;

/**
 * Called by updateHeroCombat for an attack at (x, y): the flat damage the learned on_hit slots without
 * `empower` add to it. A slot with `chance` rolls first (one rng value per attack) and reports a Cast
 * when it procs; a slot without it is passive and adds its bonus to every attack. `stunSeconds` of a
 * slot that fired goes to onHitStunTicks. Heroes with no such slot draw nothing from the rng.
 */
export function onHitBonus(run: Run, x: number, y: number): number {
  let bonus = 0;
  onHitStunTicks = 0;
  for (let i = 0; i < run.abilities.length; i++) {
    const slot = run.abilities[i];
    const def = slot.def;
    if (def.kind !== "on_hit" || slot.level < 1 || def.params.empower !== undefined) continue;
    const L = slot.level - 1;
    const p = def.params;
    const amount = p.bonusDamage?.[L] ?? 0;
    if (p.chance !== undefined) {
      if (run.rng.next() >= p.chance[L]) continue;
      startCast(run, i, amount, x, y, 0, 0);
    }
    bonus += amount;
    const stun = Math.round((p.stunSeconds?.[L] ?? 0) * TICKS_PER_SECOND);
    if (stun > onHitStunTicks) onHitStunTicks = stun;
  }
  return bonus;
}
