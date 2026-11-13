import type { GameData, Item, Rarity } from "../../data/schema";
import { RARITIES } from "../../data/schema";
import { type LoadoutEntry, SLOT_IDS, slotTypeOf } from "../../sim";

export const GEAR_PRESETS = ["none", "mid", "full"] as const;
export type GearPresetName = (typeof GEAR_PRESETS)[number];

/**
 * A loadout for balance runs. `none`: nothing. `mid`: a rare item of level 1 in every slot, one that carries the
 * hero's main attribute where the slot has one. `full`: the highest rarity the slot's type has, at the top level,
 * again leaning to the main attribute. An item is worn once, so the second ring or trinket takes the next best.
 */
export function gearPreset(data: GameData, heroId: string, preset: GearPresetName): LoadoutEntry[] {
  if (preset === "none") return [];
  const hero = data.heroes.find((candidate) => candidate.id === heroId);
  if (!hero) throw new Error(`gear preset: unknown hero ${heroId}`);
  const level = preset === "mid" ? 1 : data.rules.gear.maxPermanentLevel;
  const rank = (rarity: Rarity): number => RARITIES.indexOf(rarity);
  const leans = (item: Item): boolean => item.stats.some((row) => row.stat === hero.primary);
  const used = new Set<string>();
  const loadout: LoadoutEntry[] = [];
  for (let index = 0; index < SLOT_IDS.length; index++) {
    const type = slotTypeOf(index);
    const candidates = data.items
      .filter((item) => item.slotType === type && !used.has(item.id) && (preset === "full" || item.rarity === "rare"))
      // the highest rarity first, then the leaning ones, then the order of the data (the sort is stable)
      .sort((a, b) => rank(b.rarity) - rank(a.rarity) || Number(leans(b)) - Number(leans(a)));
    const item = candidates[0];
    if (!item) continue;
    used.add(item.id);
    loadout.push({ slot: SLOT_IDS[index]!, item: item.id, level });
  }
  return loadout;
}
