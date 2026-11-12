import type { Enemy } from "../../data/schema";
import { ENEMIES_YAML, type EnemyEntry, type ExportUnit } from "./load";

/** Export weapon_type to the kind of the enemy's attack: every missile type hits at once from range. */
const ATTACK_KINDS = new Map<string, Enemy["attack"]["kind"]>([
  ["normal", "melee"],
  ["instant", "ranged"],
  ["missile", "ranged"],
  ["msplash", "ranged"],
  ["mline", "ranged"],
  ["mbounce", "ranged"],
]);

/**
 * Builds a game enemy from its units.json record and its design entry. The entry's multipliers make
 * a variant of the map unit; they apply here, before scaling.yaml (hp and moveSpeed are rounded there).
 */
export function mapEnemy(exp: ExportUnit, entry: EnemyEntry): Enemy {
  const num = (field: keyof ExportUnit): number => {
    const value = exp[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${ENEMIES_YAML}: ${entry.id}: units.json ${exp.id} has no ${field}`);
    }
    return value;
  };
  const kind = ATTACK_KINDS.get(exp.weapon_type ?? "");
  if (!kind) {
    throw new Error(
      `${ENEMIES_YAML}: ${entry.id}: unsupported weapon_type ${JSON.stringify(exp.weapon_type)} of ${exp.id} ` +
        `in units.json; known: ${[...ATTACK_KINDS.keys()].join(", ")}`,
    );
  }
  if (entry.behavior === undefined) throw new Error(`${ENEMIES_YAML}: ${entry.id}: missing behavior`);
  const m = entry.multipliers ?? {};
  // The key order here is the order in data/generated. validateGameData (build.ts) checks the shape.
  const enemy: Enemy = {
    id: entry.id,
    name: entry.name,
    level: num("level"),
    hp: num("hp") * (m.hp ?? 1),
    hpRegen: num("hp_regen"),
    armor: num("armor"),
    moveSpeed: num("move_speed") * (m.moveSpeed ?? 1),
    collision: Math.round(num("collision") * (m.collision ?? 1)),
    acquireRange: num("acquire_range"),
    attack: {
      kind,
      range: Math.round(num("range") * (m.range ?? 1)),
      cooldown: num("cooldown"),
      damageMin: Math.round(num("damage_min") * (m.damage ?? 1)),
      damageMax: Math.round(num("damage_max") * (m.damage ?? 1)),
    },
    behavior: entry.behavior,
    xp: entry.xp,
  };
  if (entry.heal) enemy.heal = { amount: entry.heal.amount, range: entry.heal.range, cooldown: entry.heal.cooldown };
  if (entry.charge) {
    const c = entry.charge;
    enemy.charge = {
      minRange: c.minRange, maxRange: c.maxRange, windupSeconds: c.windupSeconds, speedMultiplier: c.speedMultiplier,
      damageMultiplier: c.damageMultiplier, distance: c.distance, cooldownSeconds: c.cooldownSeconds,
    };
  }
  if (entry.aura) enemy.aura = { radius: entry.aura.radius, moveSpeed: entry.aura.moveSpeed, damage: entry.aura.damage };
  if (entry.boss) enemy.boss = true;
  if (entry.model !== undefined) enemy.model = entry.model;
  if (entry.slam) {
    const s = entry.slam;
    enemy.slam = {
      radius: s.radius, damage: s.damage, windupSeconds: s.windupSeconds,
      cooldownSeconds: [s.cooldownSeconds[0], s.cooldownSeconds[1]],
    };
  }
  if (entry.strike) {
    const s = entry.strike;
    enemy.strike = {
      minRange: s.minRange, maxRange: s.maxRange, radius: s.radius, damage: s.damage,
      windupSeconds: s.windupSeconds, cooldownSeconds: s.cooldownSeconds, leap: s.leap,
    };
  }
  if (entry.hunter) enemy.hunter = true;
  return enemy;
}
