import type { AudioSource, MixLayer, Space } from "./manifest";

/** Fade at the end of a cut, so a trimmed take does not end in a click: short for effects, long for music. */
const CUT_FADE = { sfx: 0.12, music: 1.5 } as const;

/** ffmpeg arguments: effects lose leading and trailing silence and become mono Opus 64k; music stays stereo at 96k. */
export function encodeArgs(s: AudioSource, inPath: string, outPath: string): string[] {
  const filters: string[] = [];
  if (s.trim) {
    const fade = Math.min(CUT_FADE[s.kind], (s.trim[1] - s.trim[0]) / 2);
    filters.push(`afade=t=out:st=${Math.max(0, s.trim[1] - s.trim[0] - fade).toFixed(3)}:d=${fade.toFixed(3)}`);
  }
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

/** Rooms of a layered take (ffmpeg aecho: in gain, out gain, delays ms, decays). */
const SPACES: Record<Space, string> = {
  hall: "aecho=0.8:0.8:43|79|127|191|263:0.34|0.27|0.2|0.14|0.09",
  echo: "aecho=0.8:0.8:240|480|720:0.45|0.25|0.12",
};
const MIX_FADE = 0.25;
const RATE = 48000;

/** One layer's chain: mono at 48 kHz, then reverse, rate, tempo, filters, gain, the end fade of a cut, the start delay. */
function layerChain(l: MixLayer, i: number): string {
  const f = [`aformat=channel_layouts=mono`, `aresample=${RATE}`];
  if (l.trim) {
    const fade = Math.min(CUT_FADE.sfx, (l.trim[1] - l.trim[0]) / 2);
    f.push(`afade=t=out:st=${Math.max(0, l.trim[1] - l.trim[0] - fade).toFixed(3)}:d=${fade.toFixed(3)}`);
  }
  if (l.reverse) f.push("areverse");
  if (l.rate !== undefined && l.rate !== 1) f.push(`asetrate=${Math.round(RATE * l.rate)}`, `aresample=${RATE}`);
  if (l.tempo !== undefined && l.tempo !== 1) f.push(`atempo=${l.tempo}`);
  if (l.highpass !== undefined) f.push(`highpass=f=${l.highpass}`);
  if (l.lowpass !== undefined) f.push(`lowpass=f=${l.lowpass}`);
  if (l.gainDb !== undefined && l.gainDb !== 0) f.push(`volume=${l.gainDb}dB`);
  if (l.at !== undefined && l.at > 0) f.push(`adelay=${Math.round(l.at * 1000)}`);
  return `[${i}:a]${f.join(",")}[l${i}]`;
}

/** ffmpeg arguments of a layered take: every layer an input, mixed, a room, cut to its length, then as an effect. */
export function mixArgs(s: AudioSource, inPaths: string[], outPath: string): string[] {
  const layers = s.layers ?? [];
  if (layers.length === 0 || layers.length !== inPaths.length || s.length === undefined) throw new Error(`${s.out}: not a layered take`);
  const inputs = layers.flatMap((l, i) => [...(l.trim ? ["-ss", String(l.trim[0]), "-to", String(l.trim[1])] : []), "-i", inPaths[i]!]);
  const chains = layers.map(layerChain);
  const tail = [`amix=inputs=${layers.length}:normalize=0:duration=longest`];
  if (s.space) tail.push(SPACES[s.space]);
  tail.push(
    `atrim=0:${s.length}`,
    `afade=t=out:st=${(s.length - MIX_FADE).toFixed(3)}:d=${MIX_FADE}`,
    "silenceremove=start_periods=1:start_threshold=-50dB",
    "areverse",
    "silenceremove=start_periods=1:start_threshold=-50dB",
    "areverse",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
  );
  if (s.gainDb !== undefined && s.gainDb !== 0) tail.push(`volume=${s.gainDb}dB`);
  const graph = `${chains.join(";")};${layers.map((_, i) => `[l${i}]`).join("")}${tail.join(",")}[out]`;
  return ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", graph, "-map", "[out]", "-ar", String(RATE), "-ac", "1", "-c:a", "libopus", "-b:a", "64k", "-map_metadata", "-1", outPath];
}

export function audioAssetPath(s: AudioSource): string {
  return `audio/${s.out}.ogg`;
}

/** One license row per encoded file; `sha` hashes the file under assets/. */
export function licenseRows(sources: AudioSource[], sha: (path: string) => string): string[] {
  return sources.map((s) => {
    const path = audioAssetPath(s);
    const author = `${s.author}; ${s.layers ? "mixed" : "trimmed"}, loudness normalized, encoded to Opus`;
    return `| ${s.out} (\`${path}\`) | ${author} | ${s.license} | ${s.url} | ${s.downloaded} | \`${sha(path)}\` |`;
  });
}

/** Replaces the audio rows of the license table; every other row stays. */
export function mergeLicenseRows(table: string, audioRows: string[]): string {
  const kept = table.split("\n").filter((l) => !l.includes("(`audio/"));
  while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
  return `${[...kept, ...audioRows].join("\n")}\n`;
}
