import type { GameData, Rules } from "../data/schema";
import { EventKind } from "./events";
import type { Run } from "./run";
import { enemyType } from "./spawn-tables";

/** Index in `rules.factions` of the faction of a 0-based phase index (the finale keeps the last phase's faction). */
export function factionIndexOfPhase(rules: Rules, phaseIndex: number): number {
  const factions = rules.factions;
  let found = 0;
  for (let f = 1; f < factions.length; f++) {
    if (factions[f]!.fromPhase - 1 <= phaseIndex) found = f;
  }
  return found;
}

/** The type tables of the factions, built once when the run is created. */
export interface FactionTables {
  /** Faction index per 0-based phase index. */
  phaseFaction: Uint8Array;
  /** Type index of each faction's elite and heavy type. */
  eliteTypes: Int32Array;
  heavyTypes: Int32Array;
  /** 1 for every type that is the elite of some faction. */
  isElite: Uint8Array;
}

export function buildFactionTables(data: GameData): FactionTables {
  const { rules } = data;
  const eliteTypes = Int32Array.from(rules.factions, (f, i) => enemyType(data, f.elite, `rules.factions.${i}.elite`));
  const heavyTypes = Int32Array.from(rules.factions, (f, i) => enemyType(data, f.heavy, `rules.factions.${i}.heavy`));
  const isElite = new Uint8Array(data.enemies.length);
  for (const type of eliteTypes) isElite[type] = 1;
  const phaseFaction = Uint8Array.from(rules.phases, (_, p) => factionIndexOfPhase(rules, p));
  return { phaseFaction, eliteTypes, heavyTypes, isElite };
}

/**
 * Keeps `run.factionIndex` on the faction of the current phase and announces a change: `EventKind.Faction`
 * (a = faction index, value = 1-based phase). A run that starts in a later faction announces it in its first step.
 */
export function updateFaction(run: Run): void {
  const phase = run.phaseIndex;
  const faction = run.phaseFaction[phase]!;
  if (faction === run.factionIndex) return;
  run.factionIndex = faction;
  run.events.push(EventKind.Faction, faction, phase + 1, run.hero.x, run.hero.y, 0, 0);
}
