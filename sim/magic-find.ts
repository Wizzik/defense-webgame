import type { Rarity, RarityWeights, Rules } from "../data/schema";
import { RARITIES } from "../data/schema";
import type { Rng } from "./rng";

/** Magic find after diminishing returns: MF x limit / (MF + limit); 0 for MF <= 0. Never reaches `limit`. */
export function effectiveMagicFind(magicFind: number, limit: number): number {
  if (magicFind <= 0) return 0;
  return (magicFind * limit) / (magicFind + limit);
}

/**
 * The weights with magic find: the lowest rarity of `weights` (in the order of RARITIES) keeps its weight, every
 * higher one is multiplied by (1 + effective MF x rarityFactor[rarity]). Returns a new object.
 */
export function magicFindWeights(weights: RarityWeights, magicFind: number, rules: Rules["magicFind"]): RarityWeights {
  const eff = effectiveMagicFind(magicFind, rules.limit);
  const out: RarityWeights = {};
  let lowest = true;
  for (const rarity of RARITIES) {
    const w = weights[rarity];
    if (w === undefined) continue;
    // common is always the lowest rarity when present; the check narrows the key for rarityFactor
    out[rarity] = lowest || rarity === "common" ? w : w * (1 + eff * rules.rarityFactor[rarity]);
    lowest = false;
  }
  return out;
}

/** Draws a rarity by its weight with exactly one value from `rng`; the last listed rarity is the fallback. */
export function drawRarity(weights: RarityWeights, rng: Rng): Rarity {
  let total = 0;
  let last: Rarity | undefined;
  for (const rarity of RARITIES) {
    const w = weights[rarity];
    if (w === undefined) continue;
    total += w;
    last = rarity;
  }
  if (last === undefined) throw new Error("drawRarity: no rarity has a weight");
  let roll = rng.next() * total;
  for (const rarity of RARITIES) {
    const w = weights[rarity];
    if (w === undefined) continue;
    roll -= w;
    if (roll < 0) return rarity;
  }
  return last;
}
