import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { type Constants, type GameData, validateGameData } from "../../data/schema";
import { ABILITIES_YAML, type Design, HEROES_YAML, loadDesign, loadMapExport, type MapExport } from "./load";
import { mapAbility } from "./map-abilities";
import { mapHero } from "./map-heroes";

const DESIGN_DIR = join(import.meta.dirname, "..", "..", "design");
/** Attack speed cap of the map's ASP_ system (+600 %). */
const ATTACK_SPEED_CAP = 6.0;
const USAGE = "usage: npm run data:build -- --source data-source/<label>/out --out data/generated";

/** Pairs design entries with export records by source id, maps them and validates the result. */
export function buildGameData(src: MapExport, design: Design, mapVersion: string): GameData {
  const heroes = design.heroes.map((entry) =>
    mapHero(findSource(src.heroes, entry, HEROES_YAML, "heroes.json"), entry),
  );
  const abilities = design.abilities.map((entry) =>
    mapAbility(findSource(src.abilities, entry, ABILITIES_YAML, "abilities.json"), entry),
  );
  const data: GameData = { heroes, abilities, constants: mapConstants(src.mapInfo.misc_constants, mapVersion) };
  // Throws GameDataError. The parsed copy is not kept because zod reorders the keys.
  validateGameData(data);
  return data;
}

/** Writes heroes.json, abilities.json and constants.json: indent 2, keys in mapping order. */
export function writeGameData(data: GameData, outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  const files: [string, unknown][] = [
    ["heroes.json", data.heroes],
    ["abilities.json", data.abilities],
    ["constants.json", data.constants],
  ];
  for (const [file, value] of files) {
    writeFileSync(join(outDir, file), `${JSON.stringify(value, null, 2)}\n`);
  }
}

function findSource<T extends { id: string }>(
  records: T[],
  entry: { id: string; source: string },
  designFile: string,
  exportFile: string,
): T {
  const found = records.find((r) => r.id === entry.source);
  if (!found) throw new Error(`${designFile}: ${entry.id}: source ${entry.source} not found in ${exportFile}`);
  return found;
}

function mapConstants(misc: Record<string, unknown>, mapVersion: string): Constants {
  return {
    strHitPointBonus: miscNumber(misc, "StrHitPointBonus"),
    agiAttackSpeedBonus: miscNumber(misc, "AgiAttackSpeedBonus"),
    defenseArmor: miscNumber(misc, "DefenseArmor"),
    attackSpeedCap: ATTACK_SPEED_CAP,
    mapVersion,
  };
}

/** misc_constants values are strings in the export, e.g. "15.0". */
function miscNumber(misc: Record<string, unknown>, name: string): number {
  const raw = misc[name];
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value)) {
    throw new Error(`map_info.json: misc_constants.${name} is not a number: ${JSON.stringify(raw)}`);
  }
  return value;
}

/** Exports live in data-source/<label>/out; the label becomes constants.mapVersion. */
function mapVersionOf(sourceDir: string): string {
  const dir = resolve(sourceDir);
  if (basename(dir) !== "out") throw new Error(`--source must be data-source/<label>/out, got ${sourceDir}`);
  return basename(dirname(dir));
}

function main(): void {
  const { values } = parseArgs({ options: { source: { type: "string" }, out: { type: "string" } } });
  if (!values.source || !values.out) throw new Error(USAGE);
  const mapVersion = mapVersionOf(values.source);
  const data = buildGameData(loadMapExport(values.source), loadDesign(DESIGN_DIR), mapVersion);
  writeGameData(data, values.out);
  console.log(
    `data:build: ${data.heroes.length} heroes, ${data.abilities.length} abilities (${mapVersion}) -> ${values.out}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (e) {
    console.error(`data:build failed\n${(e as Error).message}`);
    process.exitCode = 1;
  }
}
