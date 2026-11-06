import type { Hero } from "../../data/schema";
import { type ExportHero, HEROES_YAML, type HeroEntry } from "./load";

/** Export weapon_type to the kind of the hero's base attack. */
const ATTACK_KINDS = new Map<string, Hero["baseAttack"]["kind"]>([
  ["normal", "melee"],
  ["missile", "ranged"],
  ["msplash", "ranged"],
  ["mline", "ranged"],
  ["mbounce", "bounce"],
]);

/** Builds a game hero from its export record and its design entry. */
export function mapHero(exp: ExportHero, entry: HeroEntry): Hero {
  const kind = ATTACK_KINDS.get(exp.weapon_type);
  if (kind === undefined) {
    throw new Error(
      `${HEROES_YAML}: ${entry.id}: unsupported weapon_type ${JSON.stringify(exp.weapon_type)} ` +
        `of ${exp.id} in heroes.json; known: ${[...ATTACK_KINDS.keys()].join(", ")}`,
    );
  }
  // The key order here is the order in data/generated. validateGameData (build.ts) checks the shape.
  return {
    id: entry.id,
    name: entry.name,
    primary: String(exp.primary).toLowerCase() as Hero["primary"],
    moveSpeed: exp.move_speed,
    attributes: {
      str: { base: exp.str, perLevel: exp.str_per_level },
      agi: { base: exp.agi, perLevel: exp.agi_per_level },
      int: { base: exp.int, perLevel: exp.int_per_level },
    },
    baseAttack: {
      kind,
      range: exp.range,
      cooldown: exp.cooldown,
      damageMin: exp.damage_min,
      damageMax: exp.damage_max,
    },
    signatureAbilities: entry.signatureAbilities,
    ultimate: entry.ultimate,
  };
}
