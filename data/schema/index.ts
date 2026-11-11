import { z } from "zod";
import { AbilitySchema } from "./ability";
import { ConstantsSchema } from "./constants";
import { EnemySchema } from "./enemy";
import { HeroSchema } from "./hero";
import { RulesSchema } from "./rules";

export { AbilityKind, AbilitySchema, Targeting } from "./ability";
export type { Ability } from "./ability";
export { LocalizedText, Slug } from "./common";
export { ConstantsSchema } from "./constants";
export type { Constants } from "./constants";
export { EnemySchema } from "./enemy";
export type { Enemy } from "./enemy";
export { PointSchema, RulesSchema } from "./rules";
export type { Point, Rules } from "./rules";
export { HeroSchema } from "./hero";
export type { Hero } from "./hero";

export const GameDataSchema = z.object({
  heroes: z.array(HeroSchema),
  abilities: z.array(AbilitySchema),
  enemies: z.array(EnemySchema),
  rules: RulesSchema,
  constants: ConstantsSchema,
}).strict();

export type GameData = z.infer<typeof GameDataSchema>;

export class GameDataError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "GameDataError";
  }
}

/** Joins an issue path; items of the top-level arrays get their id: `abilities.3 (soul-bolt).targeting`. */
function describePath(data: unknown, path: PropertyKey[]): string {
  if (path.length === 0) return "(root)";
  const parts = path.map(String);
  if (path.length >= 2 && typeof path[1] === "number") {
    const list = (data as Record<string, unknown> | null)?.[String(path[0])];
    const id = Array.isArray(list) ? (list[path[1]] as { id?: unknown } | undefined)?.id : undefined;
    if (typeof id === "string") parts[1] = `${parts[1]} (${id})`;
  }
  return parts.join(".");
}

/** Validates raw data against the schemas plus cross-reference and uniqueness rules. */
export function validateGameData(data: unknown): GameData {
  const parsed = GameDataSchema.safeParse(data);
  if (!parsed.success) {
    throw new GameDataError(
      parsed.error.issues.map((i) => `${describePath(data, i.path)}: ${i.message}`),
    );
  }
  const { heroes, abilities, enemies, rules } = parsed.data;
  const errors: string[] = [];

  const abilityIds = new Set<string>();
  abilities.forEach((a, i) => {
    if (abilityIds.has(a.id)) errors.push(`abilities.${i}.id: duplicate ability id "${a.id}"`);
    abilityIds.add(a.id);
  });

  const heroIds = new Set<string>();
  heroes.forEach((h, i) => {
    if (heroIds.has(h.id)) errors.push(`heroes.${i}.id: duplicate hero id "${h.id}"`);
    heroIds.add(h.id);
    h.signatureAbilities.forEach((slug, j) => {
      if (!abilityIds.has(slug)) {
        errors.push(`heroes.${i}.signatureAbilities.${j}: unknown ability "${slug}"`);
      }
    });
    if (!abilityIds.has(h.ultimate)) {
      errors.push(`heroes.${i}.ultimate: unknown ability "${h.ultimate}"`);
    }
  });

  const enemyIds = new Set<string>();
  enemies.forEach((e, i) => {
    if (enemyIds.has(e.id)) errors.push(`enemies.${i}.id: duplicate enemy id "${e.id}"`);
    enemyIds.add(e.id);
    if (e.attack.damageMax < e.attack.damageMin) {
      errors.push(`enemies.${i} (${e.id}).attack.damageMax: below damageMin`);
    }
  });

  if (!heroIds.has(rules.start.hero)) {
    errors.push(`rules.start.hero: unknown hero "${rules.start.hero}"`);
  }

  rules.phases.forEach((p, i) => {
    for (const id of Object.keys(p.mix)) {
      if (!enemyIds.has(id)) errors.push(`rules.phases.${i}.mix: unknown enemy "${id}"`);
    }
  });
  if (!enemyIds.has(rules.enemies.elite)) {
    errors.push(`rules.enemies.elite: unknown enemy "${rules.enemies.elite}"`);
  }
  const covered = rules.phases.length * rules.run.phaseSeconds;
  if (covered < rules.run.durationSeconds) {
    errors.push(`rules.phases: phases cover ${covered} s, the run lasts ${rules.run.durationSeconds} s`);
  }

  const { arena } = rules;
  const inside = (p: { x: number; y: number }) =>
    Math.abs(p.x) <= arena.width / 2 && Math.abs(p.y) <= arena.height / 2;
  if (!inside(arena.castle)) errors.push("rules.arena.castle: outside the arena");
  if (!inside(arena.heroStart)) errors.push("rules.arena.heroStart: outside the arena");
  arena.gates.forEach((g, i) => {
    if (!inside(g)) errors.push(`rules.arena.gates.${i}: outside the arena`);
  });

  if (errors.length > 0) throw new GameDataError(errors);
  return parsed.data;
}
