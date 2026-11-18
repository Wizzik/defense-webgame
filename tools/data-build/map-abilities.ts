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

/**
 * Builds a game ability that has no map source: every param and the cooldown must be
 * `{ design: [...] }` of one common length (1-5), which gives the levels.
 */
export function mapDesignAbility(entry: AbilityEntry): Ability {
  const where = `${ABILITIES_YAML}: ${entry.id}`;
  if (entry.review !== undefined) throw new Error(`${where}: review: an ability without source has no review`);
  const specs: [string, ParamSpec | undefined][] = [
    ["cooldown", entry.cooldown],
    ...Object.entries(entry.params ?? {}).map(([key, spec]): [string, ParamSpec] => [`params.${key}`, spec]),
  ];
  let levels: number | undefined;
  const values = new Map<string, number[]>();
  for (const [path, spec] of specs) {
    if (typeof spec !== "object" || spec === null || !Array.isArray(spec.design)) {
      throw new Error(`${where}: ${path}: an ability without source needs { design: [...] }`);
    }
    const list = spec.design;
    if (list.length < 1 || list.length > 5) throw new Error(`${where}: ${path}: needs 1-5 values, got ${list.length}`);
    if (levels === undefined) levels = list.length;
    else if (list.length !== levels) {
      throw new Error(`${where}: ${path}: has ${list.length} values, the cooldown has ${levels}`);
    }
    values.set(path, [...list]);
  }
  const params = Object.fromEntries(
    Object.keys(entry.params ?? {}).map((key) => [key, values.get(`params.${key}`) as number[]]),
  );
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    kind: entry.kind,
    targeting: entry.targeting,
    levels: levels as number,
    cooldown: values.get("cooldown") as number[],
    params,
  } as Ability;
}
