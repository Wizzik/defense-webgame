import type { GameData } from "../data/schema";
import { type LoadoutEntry, SLOT_IDS, type SlotId, slotTypeOf } from "../sim";
import { type ItemRecord, namedRecord, recordSlotType, rolledOf } from "./item-record";
import { namedRecordOf, recordByUid, type SaveData } from "./save";

/** The slots that take an item type: one, or two for rings and trinkets. */
function slotsOfType(type: string): SlotId[] {
  return SLOT_IDS.filter((_, index) => slotTypeOf(index) === type);
}

/**
 * Puts an owned item (by its record's uid) on a hero's doll. A ring or a trinket takes the first free one of its two
 * slots and replaces the first when both are taken; an item the hero already wears stays where it is. The input is
 * not changed; an item that is not owned or a hero that does not exist gives the input back.
 */
export function equip(save: SaveData, data: GameData, heroId: string, uid: number): SaveData {
  const record = recordByUid(save, uid);
  const type = record ? recordSlotType(data, record) : null;
  if (!type || !data.heroes.some((hero) => hero.id === heroId)) return save;
  const loadout = save.loadouts[heroId] ?? {};
  const slots = slotsOfType(type);
  if (slots.some((slot) => loadout[slot] === uid)) return save;
  const slot = slots.find((candidate) => loadout[candidate] === undefined) ?? slots[0]!;
  return { ...save, loadouts: { ...save.loadouts, [heroId]: { ...loadout, [slot]: uid } } };
}

/** Takes the item of a slot off a hero's doll. The input is not changed. */
export function unequip(save: SaveData, heroId: string, slot: SlotId): SaveData {
  const loadout = save.loadouts[heroId];
  if (!loadout || loadout[slot] === undefined) return save;
  const rest = { ...loadout };
  delete rest[slot];
  return { ...save, loadouts: { ...save.loadouts, [heroId]: rest } };
}

/** A record as a loadout entry for `slot`, or null when the game does not know its item. */
export function loadoutEntry(data: GameData, record: ItemRecord, slot: SlotId): LoadoutEntry | null {
  if (record.named !== undefined) {
    return data.items.some((item) => item.id === record.named) ? { slot, item: record.named, level: record.level } : null;
  }
  const rolled = rolledOf(data, record);
  return rolled ? { slot, item: `rolled-${record.base}`, level: record.level, rolled } : null;
}

/** What a hero wears into a run, in slot order, with the permanent levels of the collection. */
export function toLoadout(save: SaveData, data: GameData, heroId: string): LoadoutEntry[] {
  const loadout = save.loadouts[heroId];
  if (!loadout) return [];
  const entries: LoadoutEntry[] = [];
  for (const slot of SLOT_IDS) {
    const uid = loadout[slot];
    const record = uid === undefined ? undefined : recordByUid(save, uid);
    const entry = record ? loadoutEntry(data, record, slot) : null;
    if (entry) entries.push(entry);
  }
  return entries;
}

/**
 * For debugging: named item `id` into the collection at `level` (clamped to 1 and the top level); an owned one gets
 * the level. Unknown items give the input back. The input is not changed.
 */
export function grantNamed(save: SaveData, data: GameData, id: string, level: number): SaveData {
  const clamped = Math.max(1, Math.min(data.rules.gear.maxPermanentLevel, Math.round(level)));
  const owned = namedRecordOf(save, id);
  if (owned) {
    return { ...save, items: save.items.map((record) => (record === owned ? { ...record, level: clamped } : record)) };
  }
  const record = namedRecord(data, save.nextUid, id, clamped);
  if (!record) return save;
  return { ...save, items: [...save.items, record], nextUid: save.nextUid + 1 };
}
