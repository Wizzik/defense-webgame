import type { GameData, Item, SlotType } from "../../data/schema";
import { RARITIES } from "../../data/schema";
import type { SaveData } from "../../meta";
import { SLOT_IDS, slotTypeOf } from "../../sim";

export interface GridEntry {
  item: Item;
  owned: boolean;
  /** Permanent level; 0 when the item is not owned. */
  level: number;
  /** Whether the hero whose doll is shown wears it. */
  equipped: boolean;
}

/** The items of the collection screen: all of them or one slot type, the highest rarity first, then in the order of the data. */
export function gridEntries(data: GameData, save: SaveData, heroId: string, filter: SlotType | "all"): GridEntry[] {
  const worn = new Set(Object.values(save.loadouts[heroId] ?? {}));
  const entries: GridEntry[] = [];
  for (let rank = RARITIES.length - 1; rank >= 0; rank--) {
    for (const item of data.items) {
      if (item.rarity !== RARITIES[rank] || (filter !== "all" && item.slotType !== filter)) continue;
      const level = save.items[item.id] ?? 0;
      entries.push({ item, owned: level > 0, level, equipped: worn.has(item.id) });
    }
  }
  return entries;
}

/**
 * The worn item a new one would take the place of, for the tooltip's comparison: nothing when the item is worn
 * already or a slot of its type is free (`equip` in meta/equip.ts picks the slot the same way).
 */
export function compareTarget(data: GameData, save: SaveData, heroId: string, item: Item): { item: Item; level: number } | undefined {
  const loadout = save.loadouts[heroId] ?? {};
  const slots = SLOT_IDS.filter((_, index) => slotTypeOf(index) === item.slotType);
  if (slots.some((slot) => loadout[slot] === item.id) || slots.some((slot) => loadout[slot] === undefined)) return undefined;
  const wornId = loadout[slots[0]!]!;
  const worn = data.items.find((candidate) => candidate.id === wornId);
  const level = save.items[wornId];
  return worn && level !== undefined ? { item: worn, level } : undefined;
}
