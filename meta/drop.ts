import type { GameData, Item, Rarity } from "../data/schema";
import { RARITIES } from "../data/schema";
import { Rng } from "../sim";
import type { SaveData } from "./save";

export type Drop =
  | { kind: "new"; item: Item; level: number }
  | { kind: "level"; item: Item; level: number }
  | { kind: "none" };

/** A new item of the rarity, or one more level of an owned one; null when every item of the rarity is at the top level. */
function dropOfRarity(data: GameData, save: SaveData, rarity: Rarity, rng: Rng): Drop | null {
  const items = data.items.filter((item) => item.rarity === rarity);
  const missing = items.filter((item) => save.items[item.id] === undefined);
  if (missing.length > 0) return { kind: "new", item: missing[rng.int(missing.length)]!, level: 1 };
  const low = items.filter((item) => save.items[item.id]! < data.rules.gear.maxPermanentLevel);
  if (low.length === 0) return null;
  const item = low[rng.int(low.length)]!;
  return { kind: "level", item, level: save.items[item.id]! + 1 };
}

/**
 * What a boss drops for a player. The rarity is drawn by the weights of the boss's table (`rules.drops`); the
 * player gets an item of that rarity they do not own yet, or, when they own them all, one more permanent level
 * of one below the top level. When the whole rarity is at the top level, the other rarities of the boss are
 * tried from the highest down; when those are full too, nothing drops.
 * `seed` is the run's seed and `order` counts the bosses killed in the run before this one, so a run gives the
 * same drops whenever it is replayed with the same collection.
 */
export function rollDrop(data: GameData, save: SaveData, bossId: string, seed: number, order: number): Drop {
  const table = data.rules.drops.find((drop) => drop.boss === bossId);
  if (!table) return { kind: "none" };
  const rng = new Rng((seed ^ Math.imul(order + 1, 0x9e3779b1)) >>> 0);
  const rarities = RARITIES.filter((rarity) => table.weights[rarity] !== undefined);
  let total = 0;
  for (const rarity of rarities) total += table.weights[rarity]!;
  let roll = rng.next() * total;
  let drawn = rarities[rarities.length - 1]!;
  for (const rarity of rarities) {
    roll -= table.weights[rarity]!;
    if (roll < 0) {
      drawn = rarity;
      break;
    }
  }
  const tries = [drawn, ...rarities.filter((rarity) => rarity !== drawn).reverse()];
  for (const rarity of tries) {
    const drop = dropOfRarity(data, save, rarity, rng);
    if (drop) return drop;
  }
  return { kind: "none" };
}

/** The save with the drop in the collection. The input is not changed. */
export function applyDrop(save: SaveData, drop: Drop): SaveData {
  if (drop.kind === "none") return save;
  return { ...save, items: { ...save.items, [drop.item.id]: drop.level } };
}
