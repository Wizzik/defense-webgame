import type { Run } from "../run";
import type { PassiveBonus } from "../world";

/** Sums the params of every learned passive slot at its level into `out` (all zero without one). */
export function passiveBonuses(run: Run, out: PassiveBonus): void {
  out.attack = 0;
  out.spellPower = 0;
  out.cooldown = 0;
  out.hp = 0;
  out.regen = 0;
  out.moveSpeed = 0;
  out.attackSpeed = 0;
  out.gold = 0;
  out.magnet = 0;
  for (const slot of run.abilities) {
    const def = slot.def;
    if (def.kind !== "passive" || slot.level < 1) continue;
    const L = slot.level - 1;
    const p = def.params;
    out.attack += p.attackBonus?.[L] ?? 0;
    out.spellPower += p.spellPowerBonus?.[L] ?? 0;
    out.cooldown += p.cooldownBonus?.[L] ?? 0;
    out.hp += p.hpBonus?.[L] ?? 0;
    out.regen += p.regenBonus?.[L] ?? 0;
    out.moveSpeed += p.moveSpeedBonus?.[L] ?? 0;
    out.attackSpeed += p.attackSpeedBonus?.[L] ?? 0;
    out.gold += p.goldBonus?.[L] ?? 0;
    out.magnet += p.magnetBonus?.[L] ?? 0;
  }
}
