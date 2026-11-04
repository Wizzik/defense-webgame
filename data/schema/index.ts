import { z } from "zod";
import { AbilitySchema } from "./ability";
import { ConstantsSchema } from "./constants";
import { HeroSchema } from "./hero";

export { AbilityKind, AbilitySchema, Targeting } from "./ability";
export type { Ability } from "./ability";
export { LocalizedText, Slug, SourceId } from "./common";
export { ConstantsSchema } from "./constants";
export type { Constants } from "./constants";
export { HeroSchema } from "./hero";
export type { Hero } from "./hero";

export const GameDataSchema = z.object({
  heroes: z.array(HeroSchema),
  abilities: z.array(AbilitySchema),
  constants: ConstantsSchema,
});

export type GameData = z.infer<typeof GameDataSchema>;

export class GameDataError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("\n"));
    this.name = "GameDataError";
  }
}

/** Validates raw data against the schemas plus cross-reference and uniqueness rules. */
export function validateGameData(data: unknown): GameData {
  const parsed = GameDataSchema.safeParse(data);
  if (!parsed.success) {
    throw new GameDataError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  const { heroes, abilities } = parsed.data;
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

  if (errors.length > 0) throw new GameDataError(errors);
  return parsed.data;
}
