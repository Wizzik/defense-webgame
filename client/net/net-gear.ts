import type { GameData } from "../../data/schema";
import { STAT_IDS } from "../../data/schema";
import { type LoadoutEntry, MAX_ROWS, type RolledItem, SLOT_IDS, type SlotId } from "../../sim";
import type { NetGear, NetRolled } from "./protocol";

/**
 * A player's worn gear on the wire (co-op lobby `join` and `start`): named items by id, random items with their roll,
 * since a random item exists only in its owner's collection. Every peer reads the host's `start` with the same data,
 * so an entry the game does not know is left out the same way in every window (the run stays in lockstep).
 */

export function toNet(loadout: readonly LoadoutEntry[]): NetGear[] {
  return loadout.map((e): NetGear => {
    const r = e.rolled;
    if (!r) return [e.slot, e.item, e.level];
    return [e.slot, e.item, e.level, [r.base, r.rarity, r.effect, r.nameFirst, r.nameNoun, [...r.stats], [...r.values], [...r.tiers]]];
  });
}

/** The roll as a `RolledItem`, or null when it does not fit the game data. */
function rolledFrom(data: GameData, net: NetRolled, item: string): RolledItem | null {
  const [base, rarity, effect, nameFirst, nameNoun, stats, values, tiers] = net;
  const def = data.loot.bases[base];
  if (!def || item !== `rolled-${def.id}` || rarity > 4 || stats.length > MAX_ROWS) return null;
  if (!stats.every((s) => s < STAT_IDS.length) || new Set(stats).size !== stats.length) return null;
  if (effect >= data.rules.loot.mythicEffects.length) return null;
  const named = nameFirst >= 0 && nameNoun >= 0;
  if (named && (nameFirst >= data.loot.names.first.length || nameNoun >= data.loot.names.nouns[def.slotType].length)) return null;
  return {
    base, rarity, effect, stats: [...stats], values: [...values], tiers: [...tiers],
    nameFirst: named ? nameFirst : -1, nameNoun: named ? nameNoun : -1,
  };
}

/** The loadout of a gear list from the wire; unknown slots and random items that do not fit the data are left out. */
export function fromNet(data: GameData, gear: readonly NetGear[]): LoadoutEntry[] {
  const out: LoadoutEntry[] = [];
  for (const entry of gear) {
    const [slot, item, level] = entry;
    if (!(SLOT_IDS as readonly string[]).includes(slot)) continue;
    if (entry.length === 3) {
      out.push({ slot: slot as SlotId, item, level });
      continue;
    }
    const rolled = rolledFrom(data, entry[3], item);
    if (rolled) out.push({ slot: slot as SlotId, item, level, rolled });
  }
  return out;
}
