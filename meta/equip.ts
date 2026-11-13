import type { GameData } from "../data/schema";
import { type LoadoutEntry, SLOT_IDS, type SlotId, slotTypeOf } from "../sim";
import type { SaveData } from "./save";

/** The slots that take an item type: one, or two for rings and trinkets. */
function slotsOfType(type: string): SlotId[] {
  return SLOT_IDS.filter((_, index) => slotTypeOf(index) === type);
}

/**
 * Puts an owned item on a hero's doll. A ring or a trinket takes the first free one of its two slots and replaces
 * the first when both are taken; an item the hero already wears stays where it is. The input is not changed;
 * an item that is not owned or a hero that does not exist gives the input back.
 */
export function equip(save: SaveData, data: GameData, heroId: string, itemId: string): SaveData {
  const item = data.items.find((candidate) => candidate.id === itemId);
  if (!item || save.items[itemId] === undefined || !data.heroes.some((hero) => hero.id === heroId)) return save;
  const loadout = save.loadouts[heroId] ?? {};
  const slots = slotsOfType(item.slotType);
  if (slots.some((slot) => loadout[slot] === itemId)) return save;
  const slot = slots.find((candidate) => loadout[candidate] === undefined) ?? slots[0]!;
  return { ...save, loadouts: { ...save.loadouts, [heroId]: { ...loadout, [slot]: itemId } } };
}

/** Takes the item of a slot off a hero's doll. The input is not changed. */
export function unequip(save: SaveData, heroId: string, slot: SlotId): SaveData {
  const loadout = save.loadouts[heroId];
  if (!loadout || loadout[slot] === undefined) return save;
  const rest = { ...loadout };
  delete rest[slot];
  return { ...save, loadouts: { ...save.loadouts, [heroId]: rest } };
}

/** What a hero wears into a run, in slot order, with the permanent levels of the collection. */
export function toLoadout(save: SaveData, data: GameData, heroId: string): LoadoutEntry[] {
  const loadout = save.loadouts[heroId];
  if (!loadout) return [];
  const entries: LoadoutEntry[] = [];
  for (const slot of SLOT_IDS) {
    const item = loadout[slot];
    const level = item === undefined ? undefined : save.items[item];
    if (item === undefined || level === undefined || !data.items.some((candidate) => candidate.id === item)) continue;
    entries.push({ slot, item, level });
  }
  return entries;
}
