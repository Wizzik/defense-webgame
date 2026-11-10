import { EventKind } from "../events";
import type { Run } from "../run";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";

/**
 * Heals the hero. Auto: below autocast.healBelow of max hp; forced: always.
 * `range` and `maxTargets` are unused in phase 2a: allies have no hp, so the hero is the only target.
 */
export function updateHeal(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "heal") return;
  const mode = castMode(run, index);
  if (mode === CastMode.None) return;
  const hero = run.hero;
  const max = hero.stats.maxHp;
  if (mode === CastMode.Auto && hero.hp >= run.data.rules.autocast.healBelow * max) return;
  const heal = Math.min(max - hero.hp, def.params.amount[slot.level - 1] * hero.stats.spellPower);
  hero.hp += heal;
  startCast(run, index, heal, hero.x, hero.y, 0, 0);
  if (heal > 0) run.events.push(EventKind.Heal, index, heal, hero.x, hero.y, 0, 0);
}
