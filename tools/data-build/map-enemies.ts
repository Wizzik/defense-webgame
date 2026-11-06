import type { Enemy } from "../../data/schema";
import { ENEMIES_YAML, type EnemyEntry, type ExportUnit } from "./load";

/** Builds a game enemy from its units.json record and its design entry. */
export function mapEnemy(exp: ExportUnit, entry: EnemyEntry): Enemy {
  const num = (field: keyof ExportUnit): number => {
    const value = exp[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${ENEMIES_YAML}: ${entry.id}: units.json ${exp.id} has no ${field}`);
    }
    return value;
  };
  // The key order here is the order in data/generated. validateGameData (build.ts) checks the shape.
  return {
    id: entry.id,
    name: entry.name,
    level: num("level"),
    hp: num("hp"),
    hpRegen: num("hp_regen"),
    armor: num("armor"),
    moveSpeed: num("move_speed"),
    collision: num("collision"),
    acquireRange: num("acquire_range"),
    attack: {
      range: num("range"),
      cooldown: num("cooldown"),
      damageMin: num("damage_min"),
      damageMax: num("damage_max"),
    },
    xp: entry.xp,
  };
}
