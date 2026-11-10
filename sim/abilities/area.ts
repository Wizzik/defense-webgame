import { EventKind } from "../events";
import type { Run } from "../run";
import { hitEnemiesAround } from "./hits";
import { CastMode, castMode, startCast } from "./slots";
import type { AbilitySlot } from "./slots";
import { densestCluster } from "./targeting";

/** Strikes the densest cluster in range and heals the hero per hit. Forced casts fall back to the hero's position. */
export function updateArea(run: Run, slot: AbilitySlot, index: number): void {
  const def = slot.def;
  if (def.kind !== "area") return;
  const mode = castMode(run, index);
  if (mode === CastMode.None) return;
  const L = slot.level - 1;
  const p = def.params;
  const hero = run.hero;
  const e = run.enemies;
  const radius = p.radius[L];
  const target = densestCluster(run, hero.x, hero.y, p.range[L], radius);
  if (target < 0 && mode === CastMode.Auto) return;
  const x = target >= 0 ? e.x[target] : hero.x;
  const y = target >= 0 ? e.y[target] : hero.y;
  startCast(run, index, radius, x, y, 0, 0);
  const hits = hitEnemiesAround(run, index, x, y, radius, p.damage[L] * hero.stats.spellPower, 0, 0, 0);
  const perHit = p.healPerHit?.[L] ?? 0;
  if (perHit > 0 && hero.hp > 0) {
    const heal = Math.min(hero.stats.maxHp - hero.hp, perHit * hits);
    if (heal > 0) {
      hero.hp += heal;
      run.events.push(EventKind.Heal, index, heal, hero.x, hero.y, 0, 0);
    }
  }
}
