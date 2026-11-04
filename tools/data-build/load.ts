import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Ability, Hero } from "../../data/schema";

/** Design files as they are named in error messages. */
export const HEROES_YAML = "design/heroes.yaml";
export const ABILITIES_YAML = "design/abilities.yaml";

/** Object data fields of one export ability level. */
export const DATA_FIELDS = [
  "DataA", "DataB", "DataC", "DataD", "DataE", "DataF", "DataG", "DataH", "DataI",
] as const;
/** Plain per-level fields of one export ability level. */
export const LEVEL_FIELDS = ["cooldown", "area", "range", "duration"] as const;
export type DataField = (typeof DATA_FIELDS)[number];
export type LevelField = (typeof LEVEL_FIELDS)[number];

/** An export value. The export leaves out unknown values; some object data fields are strings. */
export type ExportValue = number | string | null | undefined;

export type ExportLevel = { level: number } & { [F in LevelField]?: ExportValue } & {
  [F in DataField]?: { field: string; name?: string; value: ExportValue } | null;
};

/** The fields data-build reads from an abilities.json record. */
export interface ExportAbility {
  id: string;
  levels: number;
  per_level: ExportLevel[];
  jass_functions?: string[];
  implementation?: "engine" | "engine+script" | "script";
}

/** The fields data-build reads from a heroes.json record. */
export interface ExportHero {
  id: string;
  primary: string;
  str: number;
  agi: number;
  int: number;
  str_per_level: number;
  agi_per_level: number;
  int_per_level: number;
  move_speed: number;
  weapon_type: string;
  range: number;
  cooldown: number;
  damage_min: number;
  damage_max: number;
}

export interface MapExport {
  heroes: ExportHero[];
  abilities: ExportAbility[];
  mapInfo: { misc_constants: Record<string, unknown> };
}

/** Where a param's per-level numbers come from: an export field or values written in the design. */
export type ParamSpec = DataField | LevelField | { design: number[] };

/** One entry of design/abilities.yaml. */
export interface AbilityEntry {
  id: string;
  source: string;
  name: Ability["name"];
  kind: Ability["kind"];
  targeting: Ability["targeting"];
  params: Record<string, ParamSpec>;
  review?: { notes: string };
}

/** One entry of design/heroes.yaml. */
export interface HeroEntry {
  id: string;
  source: string;
  /** Name of the hero in the map, only for looking it up. Never written to data/generated. */
  mapName?: string;
  name: Hero["name"];
  signatureAbilities: Hero["signatureAbilities"];
  ultimate: string;
}

export interface Design {
  heroes: HeroEntry[];
  abilities: AbilityEntry[];
}

/** Reads one map export (data-source/<label>/out). */
export function loadMapExport(dir: string): MapExport {
  const mapInfo = readJson(join(dir, "map_info.json")) as { misc_constants?: Record<string, unknown> };
  return {
    heroes: list(readJson(join(dir, "heroes.json")), "heroes.json") as ExportHero[],
    abilities: list(readJson(join(dir, "abilities.json")), "abilities.json") as ExportAbility[],
    mapInfo: { misc_constants: mapInfo.misc_constants ?? {} },
  };
}

/** Reads heroes.yaml and abilities.yaml from a design folder. */
export function loadDesign(dir: string): Design {
  return {
    heroes: list(readYaml(join(dir, "heroes.yaml")), HEROES_YAML) as HeroEntry[],
    abilities: list(readYaml(join(dir, "abilities.yaml")), ABILITIES_YAML) as AbilityEntry[],
  };
}

function readJson(path: string): unknown {
  return parseFile(path, JSON.parse);
}

function readYaml(path: string): unknown {
  return parseFile(path, parseYaml);
}

function parseFile(path: string, parse: (text: string) => unknown): unknown {
  try {
    return parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${path}: ${(e as Error).message}`);
  }
}

function list(value: unknown, file: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${file}: expected a list of entries`);
  return value;
}
