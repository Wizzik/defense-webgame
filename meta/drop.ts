import type { DifficultyId, GameData, Item, Rarity, RoleTag } from "../data/schema";
import { RARITIES } from "../data/schema";
import { bossPower, drawRarity, levelAtPower, magicFindWeights, Rng, rollItem, SLOT_COUNT, slotTypeOf } from "../sim";
import { type ItemRecord, namedRecord, rolledRecord } from "./item-record";
import { rolledAsItem } from "./item-view";
import { namedRecordOf, type SaveData } from "./save";

/**
 * What a boss dropped: a named item new to the collection, a level of an owned named item, a rolled (random) item,
 * or nothing. `item` is what the end screen and the news line show; `record` goes into the collection.
 */
export type Drop =
  | { kind: "new"; item: Item; level: number; record: ItemRecord }
  | { kind: "level"; item: Item; level: number; uid: number }
  | { kind: "rolled"; item: Item; level: number; record: ItemRecord }
  | { kind: "none" };

/** The run a boss fell in: its course (item power) and the hero's primary attribute (smart loot). */
export interface DropCourse {
  world?: number;
  difficulty?: DifficultyId;
  primary?: RoleTag;
}

/** A named item of the rarity new to the collection, or one more level of an owned one; null when all are at the top. */
function namedOfRarity(data: GameData, save: SaveData, rarity: Rarity, rng: Rng): Drop | null {
  const items = data.items.filter((item) => item.rarity === rarity);
  const missing = items.filter((item) => namedRecordOf(save, item.id) === undefined);
  if (missing.length > 0) {
    const item = missing[rng.int(missing.length)]!;
    return { kind: "new", item, level: 1, record: namedRecord(data, save.nextUid, item.id, 1)! };
  }
  const max = data.rules.gear.maxPermanentLevel;
  const low = items.filter((item) => namedRecordOf(save, item.id)!.level < max);
  if (low.length === 0) return null;
  const item = low[rng.int(low.length)]!;
  const owned = namedRecordOf(save, item.id)!;
  return { kind: "level", item, level: owned.level + 1, uid: owned.uid };
}

/**
 * What a boss drops for a player. The rarity is drawn by the weights of the boss's table (`rules.drops`), raised by
 * the hero's magic find. With `rules.loot.namedShare` of that rarity the drop is a named item (one not owned yet, or
 * one more permanent level of an owned one below the top); else, or when every named item of the rarity is at the
 * top level, it is a random item rolled for a random gear slot with the boss's item power (`bossPower`: its order,
 * the world and the difficulty) at the level that power gives (`levelAtPower`), for the hero's primary attribute.
 * `seed` is the run's seed and `order` counts the bosses killed in the run before this one, so a run gives the same
 * drops whenever it is replayed with the same collection.
 */
export function rollDrop(
  data: GameData, save: SaveData, bossId: string, seed: number, order: number, magicFind = 0, course: DropCourse = {},
): Drop {
  const table = data.rules.drops.find((drop) => drop.boss === bossId);
  if (!table) return { kind: "none" };
  const rng = new Rng((seed ^ Math.imul(order + 1, 0x9e3779b1)) >>> 0);
  const rarity = drawRarity(magicFindWeights(table.weights, magicFind, data.rules.magicFind), rng);
  const share = data.rules.loot.namedShare[rarity];
  if (share > 0 && rng.next() < share) {
    const named = namedOfRarity(data, save, rarity, rng);
    if (named) return named;
  }
  const power = bossPower(data, order, course.world ?? 1, course.difficulty ?? "normal");
  const slot = rng.int(SLOT_COUNT);
  const rolled = rollItem(data, rng, slotTypeOf(slot), rarity, power, course.primary ?? "str");
  const level = levelAtPower(data, power);
  return { kind: "rolled", item: rolledAsItem(data, rolled), level, record: rolledRecord(data, save.nextUid, rolled, level) };
}

/** The save with the drop in the collection (a new record, or the named item's new level). The input is not changed. */
export function applyDrop(save: SaveData, drop: Drop): SaveData {
  if (drop.kind === "none") return save;
  if (drop.kind === "level") {
    return { ...save, items: save.items.map((record) => (record.uid === drop.uid ? { ...record, level: drop.level } : record)) };
  }
  const record = { ...drop.record, uid: save.nextUid };
  return { ...save, items: [...save.items, record], nextUid: save.nextUid + 1 };
}

/** Rarity rank (common 0 .. mythic 4) of a drop; -1 for none. */
export function dropRank(drop: Drop): number {
  return drop.kind === "none" ? -1 : RARITIES.indexOf(drop.item.rarity);
}
