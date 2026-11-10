import type { Run } from "../run";
import type { HeroState } from "../world";

/** Sums the bonuses of every learned aura slot into `out` (all zero without one). */
export function auraBonuses(run: Run, out: HeroState["bonus"]): void {
  out.damage = 0;
  out.moveSpeed = 0;
  out.attackSpeed = 0;
  for (const slot of run.abilities) {
    const def = slot.def;
    if (def.kind !== "aura" || slot.level < 1) continue;
    const L = slot.level - 1;
    out.damage += def.params.damageBonus?.[L] ?? 0;
    out.moveSpeed += def.params.moveSpeedBonus?.[L] ?? 0;
    out.attackSpeed += def.params.attackSpeedBonus?.[L] ?? 0;
  }
}
