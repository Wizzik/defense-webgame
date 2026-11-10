import { TICKS_PER_SECOND } from "../constants";
import type { Run } from "../run";
import { abilityCooldownTicks, CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";

/** The castle counts as attacked for this many steps after a hit. */
const CASTLE_ATTACKED_TICKS = 60;

/**
 * Makes the hero and the castle immune for `duration` seconds (run.shieldTicks).
 * Never while a shield runs, so it cannot be kept up without gaps; its cooldown starts when the shield ends.
 * Auto: the hero, or an attacked castle, is below autocast.shieldBelow of max hp. Forced: always.
 */
export function updateShield(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "shield") return;
  const mode = castMode(run, index);
  if (mode === CastMode.None) return;
  if (run.shieldTicks > 0) return;
  const hero = run.hero;
  const castle = run.castle;
  if (mode === CastMode.Auto) {
    const below = run.data.rules.autocast.shieldBelow;
    const heroLow = hero.hp < below * hero.stats.maxHp;
    const castleHit = castle.lastHitTick >= 0 && run.tick - castle.lastHitTick <= CASTLE_ATTACKED_TICKS;
    if (!heroLow && !(castle.hp < below * castle.maxHp && castleHit)) return;
  }
  const seconds = def.params.duration[slot.level - 1];
  const shieldTicks = Math.round(seconds * TICKS_PER_SECOND);
  run.shieldTicks = shieldTicks;
  startCast(run, index, seconds, hero.x, hero.y, 0, 0);
  slot.cooldown = shieldTicks + abilityCooldownTicks(run, slot);
}
