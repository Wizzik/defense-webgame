import type { GameData } from "../data/schema";
import { SLOT_IDS, type SlotId, slotTypeOf } from "../sim";

/**
 * What a player keeps between runs. `items`: item id to its permanent level (an id that is missing is not owned).
 * `loadouts`: hero id to the items its doll wears, by slot. The collection is shared by all heroes.
 */
export interface SaveData {
  version: 1;
  items: Record<string, number>;
  loadouts: Record<string, Partial<Record<SlotId, string>>>;
}

export function emptySave(): SaveData {
  return { version: 1, items: {}, loadouts: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads saved data of any shape and never throws. Everything that does not fit the game data is left out and
 * counted in `dropped`: unknown items, levels that are not whole numbers from 1 to the top level, unknown heroes
 * and slots, items in a slot of another type, items that are not owned and an item worn twice by one hero.
 * `null` or `undefined` (nothing saved yet) gives an empty save with nothing dropped; data that is not a save of
 * version 1 gives an empty save and counts as one dropped entry.
 */
export function parseSave(raw: unknown, data: GameData): { save: SaveData; dropped: number } {
  const save = emptySave();
  if (raw === null || raw === undefined) return { save, dropped: 0 };
  if (!isRecord(raw) || raw.version !== 1) return { save, dropped: 1 };
  let dropped = 0;
  const maxLevel = data.rules.gear.maxPermanentLevel;
  const itemById = new Map(data.items.map((item) => [item.id, item]));

  if (isRecord(raw.items)) {
    for (const [id, level] of Object.entries(raw.items)) {
      if (itemById.has(id) && typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= maxLevel) {
        save.items[id] = level;
      } else {
        dropped++;
      }
    }
  } else if (raw.items !== undefined && raw.items !== null) {
    dropped++;
  }

  if (isRecord(raw.loadouts)) {
    for (const [heroId, loadout] of Object.entries(raw.loadouts)) {
      if (!data.heroes.some((hero) => hero.id === heroId) || !isRecord(loadout)) {
        dropped++;
        continue;
      }
      const kept: Partial<Record<SlotId, string>> = {};
      const worn = new Set<string>();
      // in slot order, so the result does not depend on the key order of the stored object
      for (const slot of Object.keys(loadout)) {
        if (!(SLOT_IDS as readonly string[]).includes(slot)) dropped++;
      }
      for (let index = 0; index < SLOT_IDS.length; index++) {
        const slot = SLOT_IDS[index]!;
        const itemId = loadout[slot];
        if (itemId === undefined) continue;
        const item = typeof itemId === "string" ? itemById.get(itemId) : undefined;
        if (!item || save.items[item.id] === undefined || item.slotType !== slotTypeOf(index) || worn.has(item.id)) {
          dropped++;
          continue;
        }
        kept[slot] = item.id;
        worn.add(item.id);
      }
      save.loadouts[heroId] = kept;
    }
  } else if (raw.loadouts !== undefined && raw.loadouts !== null) {
    dropped++;
  }
  return { save, dropped };
}
