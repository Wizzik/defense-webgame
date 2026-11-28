import type { GameData, Item, Rarity } from "../../data/schema";
import { RARITIES } from "../../data/schema";
import { levelAtPower, type LoadoutEntry, Rng, rollItem, SLOT_IDS, slotTypeOf } from "../../sim";

export const GEAR_PRESETS = ["none", "mid", "full", "rolled-mid", "rolled-full"] as const;

/**
 * Random-item presets (random items stage 5): `rolled-mid` a rare item rolled at power 2 (level 1, tier 1) in every
 * slot, the counterpart of `mid`; `rolled-full` a mythic item rolled at the top power (12: level 5, tier 4), the
 * counterpart of `full`. Rolled for the hero's primary attribute (smart loot) from a seed fixed per hero, slot and
 * `seed`, so a preset is the same in every run.
 */
const ROLLED: Record<"rolled-mid" | "rolled-full", { rarity: Rarity; power: number }> = {
  "rolled-mid": { rarity: "rare", power: 2 },
  "rolled-full": { rarity: "mythic", power: 12 },
};

function rolledPreset(data: GameData, heroId: string, preset: "rolled-mid" | "rolled-full", seed: number): LoadoutEntry[] {
  const hero = data.heroes.find((candidate) => candidate.id === heroId);
  if (!hero) throw new Error(`gear preset: unknown hero ${heroId}`);
  const { rarity, power } = ROLLED[preset];
  const level = levelAtPower(data, power);
  const heroIndex = data.heroes.indexOf(hero);
  return SLOT_IDS.map((slot, index) => {
    const rng = new Rng((seed * 1000 + heroIndex * 31 + index) * 7919 + 1);
    const rolled = rollItem(data, rng, slotTypeOf(index), rarity, power, hero.primary);
    return { slot, item: `rolled-${data.loot.bases[rolled.base]!.id}`, level, rolled };
  });
}
export type GearPresetName = (typeof GEAR_PRESETS)[number];

/**
 * A loadout for balance runs. `none`: nothing. `mid`: a legendary named item of level 1 in every slot (named items
 * are legendary or mythic since 2026-11-28; it was a rare one), one that carries the hero's main attribute where the
 * slot has one. `full`: the highest rarity the slot's type has, at the top level, again leaning to the main attribute.
 * An item is worn once, so the second ring or trinket takes the next best.
 */
export function gearPreset(data: GameData, heroId: string, preset: GearPresetName, seed = 1): LoadoutEntry[] {
  if (preset === "none") return [];
  if (preset === "rolled-mid" || preset === "rolled-full") return rolledPreset(data, heroId, preset, seed);
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
      .filter((item) => item.slotType === type && !used.has(item.id) && (preset === "full" || item.rarity === "legendary"))
      // the highest rarity first, then the leaning ones, then the order of the data (the sort is stable)
      .sort((a, b) => rank(b.rarity) - rank(a.rarity) || Number(leans(b)) - Number(leans(a)));
    const item = candidates[0];
    if (!item) continue;
    used.add(item.id);
    loadout.push({ slot: SLOT_IDS[index]!, item: item.id, level });
  }
  return loadout;
}
