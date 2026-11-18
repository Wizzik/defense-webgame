import { damageEnemy } from "../combat";
import { EventKind } from "../events";
import type { Run } from "../run";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { strongestEnemy } from "./targeting";

/** Radius of the flash on the struck enemy, in world units. */
export const INSTANT_FLASH = 90;

/**
 * Strikes the strongest enemy in range at once (a boss or an elite first, then the most hp).
 * Cast: x/y = the target, u/v = 0; a Blast (a = the slot) marks the strike for the client.
 */
export function updateInstant(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "instant") return;
  if (castMode(run, index) === CastMode.None) return;
  const L = slot.level - 1;
  const hero = run.hero;
  const e = run.enemies;
  const target = strongestEnemy(run, hero.x, hero.y, def.params.range[L]);
  if (target < 0) return;
  const tx = e.x[target];
  const ty = e.y[target];
  startCast(run, index, INSTANT_FLASH, tx, ty, 0, 0);
  run.events.push(EventKind.Blast, index, INSTANT_FLASH, tx, ty, 0, 0);
  damageEnemy(run, target, def.params.damage[L] * hero.stats.spellPower, 1, index);
}
