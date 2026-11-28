import type { Run } from "../run";
import type { HeroState } from "../world";

/** Sums the bonuses of every learned aura slot and every running transform (transform.ts) into `out` (all zero without one). */
export function auraBonuses(run: Run, out: HeroState["bonus"]): void {
  out.damage = 0;
  out.moveSpeed = 0;
  out.attackSpeed = 0;
  out.armor = 0;
  out.hp = 0;
  for (const slot of run.abilities) {
    const def = slot.def;
    if (slot.level < 1) continue;
    const L = slot.level - 1;
    if (def.kind === "transform") {
      if (!slot.active) continue;
      out.damage += def.params.damageBonus?.[L] ?? 0;
      out.armor += def.params.armorBonus?.[L] ?? 0;
      out.hp += def.params.hpBonus?.[L] ?? 0;
      continue;
    }
    if (def.kind !== "aura") continue;
    out.damage += def.params.damageBonus?.[L] ?? 0;
    out.moveSpeed += def.params.moveSpeedBonus?.[L] ?? 0;
    out.attackSpeed += def.params.attackSpeedBonus?.[L] ?? 0;
    out.armor += def.params.armorBonus?.[L] ?? 0;
  }
}
