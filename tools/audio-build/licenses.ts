import type { AudioSource } from "./manifest";

/** ffmpeg arguments: effects lose leading and trailing silence and become mono Opus 64k; music stays stereo at 96k. */
export function encodeArgs(s: AudioSource, inPath: string, outPath: string): string[] {
  const filters: string[] = [];
  if (s.kind === "sfx") {
    filters.push(
      "silenceremove=start_periods=1:start_threshold=-50dB",
      "areverse",
      "silenceremove=start_periods=1:start_threshold=-50dB",
      "areverse",
    );
  }
  filters.push(s.kind === "sfx" ? "loudnorm=I=-16:TP=-1.5:LRA=11" : "loudnorm=I=-18:TP=-1.5:LRA=11");
  if (s.gainDb !== undefined && s.gainDb !== 0) filters.push(`volume=${s.gainDb}dB`);
  const cut = s.trim ? ["-ss", String(s.trim[0]), "-to", String(s.trim[1])] : [];
  const codec = s.kind === "sfx" ? ["-ac", "1", "-c:a", "libopus", "-b:a", "64k"] : ["-ac", "2", "-c:a", "libopus", "-b:a", "96k"];
  return ["-y", "-hide_banner", "-loglevel", "error", ...cut, "-i", inPath, "-af", filters.join(","), "-ar", "48000", ...codec, "-vn", "-map_metadata", "-1", outPath];
}

export function audioAssetPath(s: AudioSource): string {
  return `audio/${s.out}.ogg`;
}

/** One license row per encoded file; `sha` hashes the file under assets/. */
export function licenseRows(sources: AudioSource[], sha: (path: string) => string): string[] {
  return sources.map((s) => {
    const path = audioAssetPath(s);
    const author = `${s.author}; trimmed, loudness normalized, encoded to Opus`;
    return `| ${s.out} (\`${path}\`) | ${author} | ${s.license} | ${s.url} | ${s.downloaded} | \`${sha(path)}\` |`;
  });
}

/** Replaces the audio rows of the license table; every other row stays. */
export function mergeLicenseRows(table: string, audioRows: string[]): string {
  const kept = table.split("\n").filter((l) => !l.includes("(`audio/"));
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  return `${[...kept, ...audioRows].join("\n")}\n`;
}
