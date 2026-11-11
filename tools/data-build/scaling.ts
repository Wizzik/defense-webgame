import type { Ability, Enemy, Hero } from "../../data/schema";

export const SCALING_YAML = "design/scaling.yaml";

/** Uniform multipliers from the map's numbers to the survivors pace (design/scaling.yaml). */
export interface Scaling {
  heroes: { moveSpeed: number; attackCooldown: number };
  abilities: { cooldown: number; damage: number };
  enemies: { hp: number; moveSpeed: number };
}

const SHAPE: { [G in keyof Scaling]: readonly string[] } = {
  heroes: ["moveSpeed", "attackCooldown"],
  abilities: ["cooldown", "damage"],
  enemies: ["hp", "moveSpeed"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Strict check of the parsed scaling.yaml: every group and key present, none unknown, all > 0. */
export function parseScaling(value: unknown): Scaling {
  if (!isRecord(value)) throw new Error(`${SCALING_YAML}: expected a mapping of groups`);
  for (const group of Object.keys(value)) {
    if (!(group in SHAPE)) throw new Error(`${SCALING_YAML}: unknown group "${group}"`);
  }
  for (const [group, keys] of Object.entries(SHAPE)) {
    const entry = value[group];
    if (!isRecord(entry)) throw new Error(`${SCALING_YAML}: ${group}: missing group`);
    for (const key of Object.keys(entry)) {
      if (!keys.includes(key)) throw new Error(`${SCALING_YAML}: ${group}.${key}: unknown key`);
    }
    for (const key of keys) {
      const factor = entry[key];
      if (typeof factor !== "number" || !Number.isFinite(factor) || factor <= 0) {
        throw new Error(`${SCALING_YAML}: ${group}.${key}: expected a number > 0, got ${JSON.stringify(factor)}`);
      }
    }
  }
  return value as unknown as Scaling;
}

const whole = (n: number): number => Math.round(n);
const seconds = (n: number): number => Math.round(n * 100) / 100;

export function scaleHero(hero: Hero, s: Scaling): Hero {
  return {
    ...hero,
    moveSpeed: whole(hero.moveSpeed * s.heroes.moveSpeed),
    baseAttack: { ...hero.baseAttack, cooldown: seconds(hero.baseAttack.cooldown * s.heroes.attackCooldown) },
  };
}

/** Param keys that `abilities.damage` multiplies: direct, per-tick, on-hit bonus and heal/shield amounts. `empower` is not one of them. */
const DAMAGE_PARAMS: readonly string[] = ["damage", "tickDamage", "amount", "bonusDamage"];

export function scaleAbility(ability: Ability, s: Scaling): Ability {
  const params: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(ability.params as Record<string, number[]>)) {
    params[key] =
      DAMAGE_PARAMS.includes(key) && Array.isArray(value) ? value.map((v) => whole(v * s.abilities.damage)) : value;
  }
  return { ...ability, cooldown: ability.cooldown.map((c) => seconds(c * s.abilities.cooldown)), params } as Ability;
}

export function scaleEnemy(enemy: Enemy, s: Scaling): Enemy {
  return {
    ...enemy,
    hp: whole(enemy.hp * s.enemies.hp),
    moveSpeed: whole(enemy.moveSpeed * s.enemies.moveSpeed),
  };
}
