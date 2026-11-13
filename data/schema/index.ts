import { z } from "zod";
import { AbilitySchema } from "./ability";
import { ConstantsSchema } from "./constants";
import { EnemySchema } from "./enemy";
import { HeroSchema } from "./hero";
import { ItemSchema, SLOT_TYPES } from "./item";
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
export { ItemSchema, RARITIES, RARITY_ROWS, SLOT_TYPES, STAT_IDS } from "./item";
export type { Effect, EffectKind, Item, Rarity, SlotType, StatId } from "./item";

export const GameDataSchema = z.object({
  heroes: z.array(HeroSchema),
  abilities: z.array(AbilitySchema),
  enemies: z.array(EnemySchema),
  rules: RulesSchema,
  items: z.array(ItemSchema),
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
  const { heroes, abilities, enemies, rules, items } = parsed.data;
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

  const byId = new Map(enemies.map((e) => [e.id, e]));
  enemies.forEach((e, i) => {
    if (e.model === undefined) return;
    const model = byId.get(e.model);
    if (!model) errors.push(`enemies.${i} (${e.id}).model: unknown enemy "${e.model}"`);
    else if (model.model !== undefined || model === e) {
      errors.push(`enemies.${i} (${e.id}).model: "${e.model}" has no model of its own`);
    }
  });
  const checkBoss = (path: string, id: string) => {
    const enemy = byId.get(id);
    if (!enemy) errors.push(`${path}: unknown enemy "${id}"`);
    else if (!enemy.boss) errors.push(`${path}: "${id}" is not a boss`);
  };
  checkBoss("rules.run.finale.boss", rules.run.finale.boss);
  rules.events.forEach((event, i) => {
    if (event.kind === "boss") checkBoss(`rules.events.${i}.enemy`, event.enemy);
    else {
      for (const id of Object.keys(event.units)) {
        if (!enemyIds.has(id)) errors.push(`rules.events.${i}.units: unknown enemy "${id}"`);
      }
    }
  });
  rules.drops.forEach((drop, i) => checkBoss(`rules.drops.${i}.boss`, drop.boss));

  const itemIds = new Set<string>();
  items.forEach((item, i) => {
    if (itemIds.has(item.id)) errors.push(`items.${i}.id: duplicate item id "${item.id}"`);
    itemIds.add(item.id);
  });
  // A chest fills an empty slot with the common item of its type, so every type needs exactly one.
  for (const type of SLOT_TYPES) {
    const count = items.filter((item) => item.rarity === "common" && item.slotType === type).length;
    if (count !== 1) errors.push(`items: ${count} common items of type ${type}, expected 1`);
  }

  if (rules.debug.phaseXp.length !== rules.phases.length) {
    errors.push(`rules.debug.phaseXp: ${rules.debug.phaseXp.length} values for ${rules.phases.length} phases`);
  }

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

  if (errors.length > 0) throw new GameDataError(errors);
  return parsed.data;
}
