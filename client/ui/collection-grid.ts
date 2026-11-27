import type { GameData, Item, Rarity, RoleTag, SlotType } from "../../data/schema";
import { RARITIES } from "../../data/schema";
import { canSalvage, type ItemRecord, namedRecordOf, recordByUid, recordItem, type SaveData } from "../../meta";
import { itemStatAt, SLOT_IDS, slotTypeOf } from "../../sim";

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
  /** A random item no doll wears: the salvage button may take it. */
  salvageable: boolean;
  /** The role the item serves (rolledRole / namedRole). */
  role: RoleTag;
  /** Item points at its level (itemPower), for the sort by power. */
  power: number;
}

/** The filters and the order of the collection screen beyond the slot type. */
export interface GridOptions {
  role?: RoleTag | "all";
  rarity?: Rarity | "all";
  /** "rarity" (the default): the highest rarity first, named before random; "power": the strongest first. */
  sort?: "rarity" | "power";
}

/** What the grid shows: at most `rules.loot.collectionLimit` entries; `total` counts every entry of the filters. */
export interface GridList {
  entries: GridEntry[];
  total: number;
}

/**
 * The role of an item: a random item's base flavour (heavy str, light agi, cloth int, neutral any); a named item
 * serves the first primary attribute among its rows, or any.
 */
export function itemRole(data: GameData, item: Item): RoleTag {
  if (item.id.startsWith("rolled-")) {
    const base = data.loot.bases.find((b) => `rolled-${b.id}` === item.id);
    return base?.flavour ?? "any";
  }
  const row = item.stats.find((r) => r.stat === "str" || r.stat === "agi" || r.stat === "int");
  return (row?.stat as RoleTag | undefined) ?? "any";
}

/**
 * The strength of an item for sorting: the sum of its rows in budget points (value / the unit of its stat's affix,
 * design/affixes.yaml) at permanent level `level`, so random and named items compare on one scale.
 */
export function itemPower(data: GameData, item: Item, level: number): number {
  let points = 0;
  for (const row of item.stats) {
    const unit = data.loot.affixes.find((a) => a.stat === row.stat)?.unit;
    if (unit) points += itemStatAt(row.value, Math.max(1, level), 0, data.rules.gear) / unit;
  }
  return points;
}

const rankOf = (rarity: string): number => RARITIES.indexOf(rarity as (typeof RARITIES)[number]);

/**
 * The items of the collection screen, all of them or one slot type, role and rarity: every named item (owned or
 * not) the highest rarity first, then in the order of the data; after them the rolled items of the collection, the
 * highest rarity first, then in the order they came. With `sort: "power"` the strongest come first (owned before
 * not owned; ties keep the order above).
 */
export function gridEntries(
  data: GameData, save: SaveData, heroId: string, filter: SlotType | "all", options: GridOptions = {},
): GridEntry[] {
  const worn = new Set(Object.values(save.loadouts[heroId] ?? {}));
  const role = options.role ?? "all";
  const rarity = options.rarity ?? "all";
  const fits = (item: Item): boolean => (filter === "all" || item.slotType === filter)
    && (rarity === "all" || item.rarity === rarity) && (role === "all" || itemRole(data, item) === role);
  const entries: GridEntry[] = [];
  for (let rank = RARITIES.length - 1; rank >= 0; rank--) {
    for (const item of data.items) {
      if (item.rarity !== RARITIES[rank] || !fits(item)) continue;
      const record = namedRecordOf(save, item.id);
      const level = record?.level ?? 0;
      entries.push({
        item, uid: record?.uid ?? 0, owned: record !== undefined, level,
        equipped: record !== undefined && worn.has(record.uid), rolled: false, salvageable: false,
        role: itemRole(data, item), power: itemPower(data, item, level),
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
    entries.push({
      item, uid: record.uid, owned: true, level: record.level, equipped: worn.has(record.uid), rolled: true,
      salvageable: canSalvage(save, record.uid), role: itemRole(data, item), power: itemPower(data, item, record.level),
    });
  }
  if (options.sort === "power") {
    // Array.prototype.sort is stable: ties keep the rarity order
    entries.sort((a, b) => Number(b.owned) - Number(a.owned) || b.power - a.power);
  }
  return entries;
}

/** The entries the grid draws: the first `rules.loot.collectionLimit`, and how many the filters give in all. */
export function gridList(
  data: GameData, save: SaveData, heroId: string, filter: SlotType | "all", options: GridOptions = {},
): GridList {
  const all = gridEntries(data, save, heroId, filter, options);
  return { entries: all.slice(0, data.rules.loot.collectionLimit), total: all.length };
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
