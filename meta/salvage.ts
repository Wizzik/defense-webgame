import type { GameData } from "../data/schema";
import { recordByUid, type SaveData } from "./save";

/**
 * Salvage (random items plan, task 16; Petr's answer 9.2; named items too since 2026-11-28): an item nobody wears
 * turns into gold for the next run. The gold (`rules.loot.salvageGold` by rarity x the record's level) goes into the
 * save's bank, which holds at most `rules.loot.bankLimit`; the next solo run starts with the whole bank and empties it
 * (`takeBank`). A salvaged named item is no longer owned and may drop again (new, level 1).
 */

/** Whether the record `uid` may be salvaged: an item (named or random) that no hero's doll wears. */
export function canSalvage(save: SaveData, uid: number): boolean {
  const record = recordByUid(save, uid);
  if (!record) return false;
  return !Object.values(save.loadouts).some((loadout) => Object.values(loadout).includes(uid));
}

/** The gold record `uid` gives when salvaged (before the bank's limit), 0 when it cannot be salvaged. */
export function salvageValue(data: GameData, save: SaveData, uid: number): number {
  if (!canSalvage(save, uid)) return 0;
  const record = recordByUid(save, uid)!;
  return data.rules.loot.salvageGold[record.rarity] * record.level;
}

/** The save without the record `uid` and with its gold in the bank (kept to the limit); the same save when it cannot. */
export function salvage(data: GameData, save: SaveData, uid: number): SaveData {
  const gold = salvageValue(data, save, uid);
  if (!canSalvage(save, uid)) return save;
  return {
    ...save,
    items: save.items.filter((record) => record.uid !== uid),
    bankGold: Math.min(data.rules.loot.bankLimit, save.bankGold + gold),
  };
}

/** The bank's gold for a run that starts, and the save with an empty bank. */
export function takeBank(save: SaveData): { save: SaveData; gold: number } {
  if (save.bankGold === 0) return { save, gold: 0 };
  return { save: { ...save, bankGold: 0 }, gold: save.bankGold };
}
