import { TICKS_PER_SECOND } from "../../sim/constants";
import { isEmptySlot, ULTIMATE_SLOT } from "../../sim/index";
import type { Run } from "../../sim/index";
import { timeScale } from "../../sim/spawner";
import type { GameData } from "../../data/schema";
import type { RunSummary } from "./run";

/** Phases at whose start `sim:run` records the burst (spec 2026-11-19, 4.3). */
export const BURST_PHASES = [5, 10, 15, 20] as const;

/** Damage rows counted for one cast, in this order; heals are not counted. */
const BURST_PARAMS = ["damage", "bonusDamage", "tickDamage"] as const;

/**
 * One cast of the strongest learned signature spell (slots 0-2): the first of `damage`, `bonusDamage`,
 * `tickDamage` at the slot's level, times spell power. Armor is ignored (spells ignore it). 0 when none.
 */
export function spellBurst(run: Run): number {
  let best = 0;
  for (let i = 0; i < ULTIMATE_SLOT; i++) {
    const slot = run.abilities[i];
    if (!slot || isEmptySlot(slot) || slot.level < 1) continue;
    const params = slot.def.params as Record<string, number[] | undefined>;
    const row = BURST_PARAMS.map((key) => params[key]).find((r) => r !== undefined);
    if (!row) continue;
    best = Math.max(best, row[Math.min(slot.level, row.length) - 1]! * run.hero.stats.spellPower);
  }
  return best;
}

/** The average hit of the base attack before armor. */
export function attackHit(run: Run): number {
  return (run.hero.stats.damageMin + run.hero.stats.damageMax) / 2;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * `  burst p5 spell 200 (sb 0.97 ln 0.22) attack 20 (ln 0.02) | p10 ... | p15 - | p20 -`: the median burst and
 * attack hit of the runs that reached each phase, and their ratio to the shieldbearer's and lancer's hp at its start.
 */
export function burstLine(summaries: RunSummary[], data: GameData): string {
  const hp = (id: string) => data.enemies.find((e) => e.id === id)?.hp ?? 0;
  const parts = BURST_PHASES.map((phase, k) => {
    const spells = summaries.map((s) => s.burst[k]).filter((v): v is number => v !== null && v !== undefined);
    const attacks = summaries.map((s) => s.attack[k]).filter((v): v is number => v !== null && v !== undefined);
    if (spells.length === 0) return `p${phase} -`;
    const scale = timeScale(data.rules, (phase - 1) * data.rules.run.phaseSeconds * TICKS_PER_SECOND);
    const sb = hp("shieldbearer") * scale;
    const ln = hp("lancer") * scale;
    const spell = Math.round(median(spells));
    const attack = Math.round(median(attacks));
    return (
      `p${phase} spell ${spell} (sb ${(spell / sb).toFixed(2)} ln ${(spell / ln).toFixed(2)}) ` +
      `attack ${attack} (ln ${(attack / ln).toFixed(2)})`
    );
  });
  return `  burst ${parts.join(" | ")}`;
}
