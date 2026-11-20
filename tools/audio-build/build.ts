/** Checks design/audio.yaml against the game data and the files under assets/, writes data/generated/audio.json. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { validateAudio } from "./validate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const generated = (file: string) => JSON.parse(readFileSync(join(ROOT, "data", "generated", file), "utf8")) as never;

const raw = parse(readFileSync(join(ROOT, "design", "audio.yaml"), "utf8")) as unknown;
const game = { abilities: generated("abilities.json"), heroes: generated("heroes.json"), enemies: generated("enemies.json") };
try {
  const data = validateAudio(raw, game, (path) => existsSync(join(ROOT, "assets", path)));
  writeFileSync(join(ROOT, "data", "generated", "audio.json"), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`audio.json: ${data.cues.length} cues, ${data.tracks.length} tracks`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
