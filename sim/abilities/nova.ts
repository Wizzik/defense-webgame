import { TICKS_PER_SECOND } from "../constants";
import type { Run } from "../run";
import { hitEnemiesAround } from "./hits";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { countEnemiesWithin } from "./targeting";

/** Strikes everything around the hero; auto-casts once enough enemies are inside the radius. */
export function updateNova(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "nova") return;
  const mode = castMode(run, index);
  if (mode === CastMode.None) return;
  const L = slot.level - 1;
  const p = def.params;
  const hero = run.hero;
  const radius = p.radius[L];
  if (mode === CastMode.Auto
    && countEnemiesWithin(run, hero.x, hero.y, radius) < run.data.rules.autocast.novaMinEnemies) return;
  startCast(run, index, radius, hero.x, hero.y, 0, 0);
  const slowTicks = Math.round((p.slowSeconds?.[L] ?? 0) * TICKS_PER_SECOND);
  hitEnemiesAround(run, index, hero.x, hero.y, radius, p.damage[L] * hero.stats.spellPower,
    0, p.slow?.[L] ?? 0, slowTicks);
}
