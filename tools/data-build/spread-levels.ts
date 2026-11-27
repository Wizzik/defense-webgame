import type { Ability } from "../../data/schema";

/**
 * Spreads an ability's rows over `target` levels (Petr 2026-11-26: 10 levels for every spell but the ultimates):
 * new level 1 is the old level 1, the new top level the old top level, and the levels between interpolate the old
 * rows linearly at position (L - 1) x (old - 1) / (target - 1). A row of whole numbers stays whole (rounded), any
 * other row keeps four decimals (shares like 0.175) and the cooldown two. Abilities with at most `keepUpTo` levels (the ultimates: 2) or
 * already `target` levels are returned as they are.
 */
export function spreadLevels(ability: Ability, target: number, keepUpTo = 2): Ability {
  const old = ability.cooldown.length;
  if (old <= keepUpTo || old >= target) return ability;
  const spread = (row: readonly number[], round: (n: number) => number): number[] => {
    const out: number[] = [];
    for (let level = 0; level < target; level++) {
      const at = (level * (old - 1)) / (target - 1);
      const low = Math.floor(at);
      const high = Math.min(old - 1, low + 1);
      const value = row[low]! + (row[high]! - row[low]!) * (at - low);
      out.push(round(value));
    }
    return out;
  };
  const whole = (n: number): number => Math.round(n);
  const hundredths = (n: number): number => Math.round(n * 100) / 100;
  const tenThousandths = (n: number): number => Math.round(n * 10000) / 10000;
  const params: Record<string, number[]> = {};
  for (const [key, row] of Object.entries(ability.params as Record<string, number[]>)) {
    params[key] = spread(row, row.every((v) => Number.isInteger(v)) ? whole : tenThousandths);
  }
  return { ...ability, levels: target, cooldown: spread(ability.cooldown, hundredths), params } as Ability;
}
