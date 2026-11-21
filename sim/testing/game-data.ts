// Tests and tools only; the client does not import this file.
import abilities from "../../data/generated/abilities.json";
import constants from "../../data/generated/constants.json";
import enemies from "../../data/generated/enemies.json";
import heroes from "../../data/generated/heroes.json";
import items from "../../data/generated/items.json";
import rules from "../../data/generated/rules.json";
import worlds from "../../data/generated/worlds.json";
import { validateGameData } from "../../data/schema";
import type { GameData } from "../../data/schema";

/** Returns a fresh copy on every call (validation rebuilds the objects), so tests may mutate it. */
export function gameData(): GameData {
  return validateGameData({ heroes, abilities, enemies, rules, items, constants, worlds });
}

/** No islands, no paths and the wall moved out of the arena: the open field of the tests written before obstacles. */
export function openArena(data: GameData): GameData {
  for (const world of data.worlds) {
    world.map.islands.count = { min: 0, max: 0 };
    world.map.paths.lines = [];
    world.map.paths.speedBonus = 0;
    world.map.feature.segments = [[-9000, -9000, -8999, -9000]];
  }
  return data;
}
