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
    if (def.kind !== "on_hit" || !slot.active || slot.level < 1) continue;
    const multiplier = 1 + (def.params.empower?.[slot.level - 1] ?? 0);
    slot.active = false;
    startCast(run, i, multiplier, x, y, 0, 0);
    return multiplier;
  }
  return 1;
}
