// Tests and tools only; the client does not import this file.
import abilities from "../../data/generated/abilities.json";
import constants from "../../data/generated/constants.json";
import enemies from "../../data/generated/enemies.json";
import heroes from "../../data/generated/heroes.json";
import rules from "../../data/generated/rules.json";
import { validateGameData } from "../../data/schema";
import type { GameData } from "../../data/schema";

/** Returns a fresh copy on every call (validation rebuilds the objects), so tests may mutate it. */
export function gameData(): GameData {
  return validateGameData({ heroes, abilities, enemies, rules, constants });
}
