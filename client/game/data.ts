import { type GameData, validateGameData } from "../../data/schema";
import abilities from "../../data/generated/abilities.json";
import constants from "../../data/generated/constants.json";
import enemies from "../../data/generated/enemies.json";
import heroes from "../../data/generated/heroes.json";
import rules from "../../data/generated/rules.json";

/** Bundled game data, validated once at start so a broken data file fails loudly. */
export function loadGameData(): GameData {
  return validateGameData({ heroes, abilities, enemies, rules, constants });
}
