import { TICKS_PER_SECOND } from "../constants";
import { refreshHeroStats } from "../level-up";
import type { Run } from "../run";
import { abilityCooldownTicks, CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { countEnemiesWithin } from "./targeting";

/** The crowd an auto-cast transform waits for: rules.autocast.novaMinEnemies within this radius of the hero. */
export const TRANSFORM_CROWD_RADIUS = 400;

/**
 * A timed self buff (the map's Avatar): for `duration` seconds the slot is active and auraBonuses (aura.ts) adds its
 * `hpBonus` (share of max hp), `armorBonus` (flat) and `damageBonus` (share of attack damage). The stats are refreshed
 * when it starts (hp grows with max hp) and when it ends (hp stays, capped at the new max). Its cooldown starts when
 * it ends. Auto: novaMinEnemies enemies within TRANSFORM_CROWD_RADIUS. Draws nothing from the rng.
 */
export function updateTransform(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "transform") return;
  const hero = run.hero;
  if (slot.active) {
    slot.ticksLeft--;
    if (slot.ticksLeft > 0) return;
    slot.active = false;
    const hp = hero.hp;
    refreshHeroStats(run);
    if (hp > 0) hero.hp = Math.min(hp, hero.stats.maxHp);
    return;
  }
  const mode = castMode(run, index);
  if (mode === CastMode.None) return;
  if (mode === CastMode.Auto
    && countEnemiesWithin(run, hero.x, hero.y, TRANSFORM_CROWD_RADIUS) < run.data.rules.autocast.novaMinEnemies) return;
  const ticks = Math.round(def.params.duration[slot.level - 1] * TICKS_PER_SECOND);
  startCast(run, index, def.params.duration[slot.level - 1], hero.x, hero.y, 0, 0);
  slot.active = true;
  slot.ticksLeft = ticks;
  slot.cooldown = ticks + abilityCooldownTicks(run, slot);
  refreshHeroStats(run);
}
