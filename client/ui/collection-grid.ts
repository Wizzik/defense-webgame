import type { GameData, Item, SlotType } from "../../data/schema";
import { RARITIES } from "../../data/schema";
import { type ItemRecord, namedRecordOf, recordByUid, recordItem, type SaveData } from "../../meta";
import { SLOT_IDS, slotTypeOf } from "../../sim";

export interface GridEntry {
  item: Item;
  /** Uid of the collection's record; 0 for a named item that is not owned. */
  uid: number;
  owned: boolean;
  /** Permanent level; 0 when the item is not owned. */
  level: number;
  /** Whether the hero whose doll is shown wears it. */
  equipped: boolean;
  /** A random item (its record carries its rows). */
  rolled: boolean;
}

const rankOf = (rarity: string): number => RARITIES.indexOf(rarity as (typeof RARITIES)[number]);

/**
 * The items of the collection screen, all of them or one slot type: every named item (owned or not) the highest
 * rarity first, then in the order of the data; after them the rolled items of the collection, the highest rarity
 * first, then in the order they came.
 */
export function gridEntries(data: GameData, save: SaveData, heroId: string, filter: SlotType | "all"): GridEntry[] {
  const worn = new Set(Object.values(save.loadouts[heroId] ?? {}));
  const fits = (item: Item): boolean => filter === "all" || item.slotType === filter;
  const entries: GridEntry[] = [];
  for (let rank = RARITIES.length - 1; rank >= 0; rank--) {
    for (const item of data.items) {
      if (item.rarity !== RARITIES[rank] || !fits(item)) continue;
      const record = namedRecordOf(save, item.id);
      entries.push({
        item, uid: record?.uid ?? 0, owned: record !== undefined, level: record?.level ?? 0,
        equipped: record !== undefined && worn.has(record.uid), rolled: false,
      });
    }
  }
  const rolled: { record: ItemRecord; item: Item }[] = [];
  for (const record of save.items) {
    if (record.named !== undefined) continue;
    const item = recordItem(data, record);
    if (item && fits(item)) rolled.push({ record, item });
  }
  rolled.sort((a, b) => rankOf(b.item.rarity) - rankOf(a.item.rarity) || a.record.uid - b.record.uid);
  for (const { record, item } of rolled) {
    entries.push({ item, uid: record.uid, owned: true, level: record.level, equipped: worn.has(record.uid), rolled: true });
  }
  return entries;
}

/**
 * The worn item a new one (the record `uid` of `item`'s slot type; 0 for an item not owned) would take the place of,
 * for the tooltip's comparison: nothing when it is worn already or a slot of its type is free (`equip` in
 * meta/equip.ts picks the slot the same way).
 */
export function compareTarget(
  data: GameData, save: SaveData, heroId: string, item: Item, uid: number,
): { item: Item; level: number } | undefined {
  const loadout = save.loadouts[heroId] ?? {};
  const slots = SLOT_IDS.filter((_, index) => slotTypeOf(index) === item.slotType);
  if (slots.some((slot) => loadout[slot] === uid) || slots.some((slot) => loadout[slot] === undefined)) return undefined;
  const record = recordByUid(save, loadout[slots[0]!]!);
  const worn = record ? recordItem(data, record) : null;
  return worn && record ? { item: worn, level: record.level } : undefined;
}
