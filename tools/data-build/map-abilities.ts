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
  // The key order here is the order in data/generated. validateGameData (build.ts) checks the shape.
  return {
    id: entry.id,
    source: exp.id,
    name: entry.name,
    kind: entry.kind,
    targeting: entry.targeting,
    levels: exp.levels,
    cooldown: resolve("cooldown", "cooldown"),
    params,
    ...review(exp, entry, where),
  } as Ability;
}

/** Script-backed abilities list the JASS functions to read when they are ported. */
function review(exp: ExportAbility, entry: AbilityEntry, where: string): Pick<Ability, "review"> {
  const reason = exp.implementation;
  if (reason === "script" || reason === "engine+script") {
    const notes = entry.review?.notes;
    const jassFunctions = [...new Set([...(exp.jass_functions ?? []), ...(entry.review?.jassFunctions ?? [])])];
    return { review: { reason, jassFunctions, ...(notes === undefined ? {} : { notes }) } };
  }
  if (entry.review !== undefined) {
    throw new Error(`${where}: review: ${exp.id} is not script-backed (implementation ${reason ?? "none"})`);
  }
  return {};
}
