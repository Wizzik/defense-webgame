/** Encodes every source of the manifest into assets/audio/ and rewrites the audio rows of assets/LICENSES.md.
 * `--only a,b` encodes only the cues whose ids are listed (sfx/<id>-n); every license row is still rewritten. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { audioAssetPath, encodeArgs, licenseRows, mergeLicenseRows, mixArgs } from "./licenses";
import { AUDIO_SOURCES, type AudioSource } from "./manifest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_DIR = join(ROOT, "audio-source");
const ASSETS = join(ROOT, "assets");
const LICENSES = join(ASSETS, "LICENSES.md");

const onlyArg = process.argv.indexOf("--only");
const only = onlyArg >= 0 ? new Set((process.argv[onlyArg + 1] ?? "").split(",").filter(Boolean)) : null;
const cueOf = (s: AudioSource): string => s.out.replace(/^sfx\//, "").replace(/-\d+$/, "");
const selected = only ? AUDIO_SOURCES.filter((s) => only.has(cueOf(s))) : AUDIO_SOURCES;
if (only && selected.length === 0) {
  console.error(`--only matched no cue: ${[...only].join(", ")}`);
  process.exit(1);
}

const srcs = (s: AudioSource): string[] => (s.layers ? s.layers.map((l) => l.src) : [s.src]);
const missing = selected.flatMap((s) => srcs(s).filter((p) => !existsSync(join(SOURCE_DIR, p))).map((p) => `  ${p} (for ${s.out})`));
if (missing.length > 0) {
  console.error(`missing sources under audio-source/:\n${missing.join("\n")}`);
  process.exit(1);
}

for (const s of selected) {
  const out = join(ASSETS, audioAssetPath(s));
  mkdirSync(dirname(out), { recursive: true });
  const inPaths = srcs(s).map((p) => join(SOURCE_DIR, p));
  const args = s.layers ? mixArgs(s, inPaths, out) : encodeArgs(s, inPaths[0]!, out);
  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`ffmpeg failed for ${s.out}`);
    process.exit(1);
  }
  console.log(`${audioAssetPath(s)}: ${readFileSync(out).length} bytes`);
}

const sha = (path: string): string => createHash("sha256").update(readFileSync(join(ASSETS, path))).digest("hex");
writeFileSync(LICENSES, mergeLicenseRows(readFileSync(LICENSES, "utf8"), licenseRows(AUDIO_SOURCES, sha)));
console.log(`${selected.length} audio files encoded, ${AUDIO_SOURCES.length} license rows written`);
