/** Encodes every source of the manifest into assets/audio/ and rewrites the audio rows of assets/LICENSES.md. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { audioAssetPath, encodeArgs, licenseRows, mergeLicenseRows } from "./licenses";
import { AUDIO_SOURCES } from "./manifest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_DIR = join(ROOT, "audio-source");
const ASSETS = join(ROOT, "assets");
const LICENSES = join(ASSETS, "LICENSES.md");

const missing = AUDIO_SOURCES.filter((s) => !existsSync(join(SOURCE_DIR, s.src)));
if (missing.length > 0) {
  console.error(`missing sources under audio-source/:\n${missing.map((s) => `  ${s.src} (for ${s.out})`).join("\n")}`);
  process.exit(1);
}

for (const s of AUDIO_SOURCES) {
  const out = join(ASSETS, audioAssetPath(s));
  mkdirSync(dirname(out), { recursive: true });
  const result = spawnSync("ffmpeg", encodeArgs(s, join(SOURCE_DIR, s.src), out), { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`ffmpeg failed for ${s.src}`);
    process.exit(1);
  }
  console.log(`${audioAssetPath(s)}: ${readFileSync(out).length} bytes`);
}

const sha = (path: string): string => createHash("sha256").update(readFileSync(join(ASSETS, path))).digest("hex");
writeFileSync(LICENSES, mergeLicenseRows(readFileSync(LICENSES, "utf8"), licenseRows(AUDIO_SOURCES, sha)));
console.log(`${AUDIO_SOURCES.length} audio files, license rows written`);
