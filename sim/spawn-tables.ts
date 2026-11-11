import type { GameData } from "../data/schema";

/** Weighted enemy types of one phase: `cumulative[i]` is the sum of the weights up to entry i. */
export interface PhaseTable {
  types: Int32Array;
  cumulative: Float64Array;
  total: number;
}

/** One table per phase, entries in the order of the phase's `mix`. Built once, when the run is created. */
export function buildPhaseTables(data: GameData): PhaseTable[] {
  return data.rules.phases.map((phase, p) => {
    const entries = Object.entries(phase.mix);
    const types = new Int32Array(entries.length);
    const cumulative = new Float64Array(entries.length);
    let total = 0;
    entries.forEach(([id, weight], i) => {
      types[i] = enemyType(data, id, `phase ${p}`);
      total += weight;
      cumulative[i] = total;
    });
    return { types, cumulative, total };
  });
}

/** Index of the enemy `id` in `data.enemies`. */
export function enemyType(data: GameData, id: string, where: string): number {
  const type = data.enemies.findIndex((e) => e.id === id);
  if (type < 0) throw new Error(`spawn tables: unknown enemy "${id}" (${where})`);
  return type;
}

/** The type a `roll` in [0, 1) lands on. */
export function pickType(table: PhaseTable, roll: number): number {
  const target = roll * table.total;
  const last = table.types.length - 1;
  for (let i = 0; i < last; i++) {
    if (target < table.cumulative[i]) return table.types[i];
  }
  return table.types[last];
}
