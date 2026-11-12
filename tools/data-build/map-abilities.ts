import type { Ability } from "../../data/schema";
import { ABILITIES_YAML, type AbilityEntry, type ExportAbility, type ParamSpec } from "./load";
import { resolveParam } from "./resolve";

/** Builds a game ability from its export record and its design entry. */
export function mapAbility(exp: ExportAbility, entry: AbilityEntry): Ability {
  const where = `${ABILITIES_YAML}: ${entry.id}`;
  const resolve = (path: string, spec: ParamSpec): number[] => {
    try {
      return resolveParam(exp, spec, exp.levels);
    } catch (e) {
      throw new Error(`${where}: ${path}: ${(e as Error).message}`);
    }
  };
  const params = Object.fromEntries(
    Object.entries(entry.params ?? {}).map(([key, spec]) => [key, resolve(`params.${key}`, spec)]),
  );
  checkReview(exp, entry, where);
  // The key order here is the order in data/generated. validateGameData (build.ts) checks the shape.
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    kind: entry.kind,
    targeting: entry.targeting,
    levels: exp.levels,
    cooldown: resolve("cooldown", entry.cooldown ?? "cooldown"),
    params,
  } as Ability;
}

/** The review notes stay in design/abilities.yaml; they may only sit on script-backed abilities. */
function checkReview(exp: ExportAbility, entry: AbilityEntry, where: string): void {
  const reason = exp.implementation;
  if (entry.review !== undefined && reason !== "script" && reason !== "engine+script") {
    throw new Error(`${where}: review: ${exp.id} is not script-backed (implementation ${reason ?? "none"})`);
  }
}
