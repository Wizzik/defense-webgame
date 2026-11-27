import { METER_ATTACK, METER_ITEM, METER_SOURCES, METER_THORNS, type PlayerState } from "../../sim";

/** A player's damage meter by source name: ability id, `attack`, `item` or `thorns` (sim/damage-meter.ts). */
export function meterOf(player: PlayerState): Record<string, number> {
  const out: Record<string, number> = {};
  for (let source = 0; source < METER_SOURCES; source++) {
    const damage = player.meter.damage[source]!;
    if (damage <= 0) continue;
    const name = source === METER_ATTACK ? "attack" : source === METER_ITEM ? "item" : source === METER_THORNS ? "thorns"
      : (player.abilities[source]?.def.id ?? `slot-${source}`);
    out[name] = (out[name] ?? 0) + damage;
  }
  return out;
}

/**
 * `  meter rock-rupture 62 % | attack 20 % | ...`: each source's share of all the damage of the runs, the biggest
 * first, at most `top` of them.
 */
export function meterLine(meters: readonly Record<string, number>[], top = 8): string {
  const sum = new Map<string, number>();
  for (const meter of meters) for (const [name, damage] of Object.entries(meter)) sum.set(name, (sum.get(name) ?? 0) + damage);
  let total = 0;
  for (const damage of sum.values()) total += damage;
  if (total <= 0) return "  meter -";
  const parts = [...sum.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top)
    .map(([name, damage]) => `${name} ${Math.round((damage / total) * 100)} %`);
  return `  meter ${parts.join(" | ")}`;
}
