/** Recorded sounds and music: where each output file comes from. Sources live in audio-source/ (untracked, untrusted). */
export interface AudioSource {
  /** Output path under assets/audio/ without extension, e.g. "sfx/stone-hit-1". */
  out: string;
  /** Source file path under audio-source/. */
  src: string;
  kind: "sfx" | "music";
  author: string;
  license: "CC0 1.0" | "CC-BY 3.0" | "CC-BY 4.0";
  url: string;
  /** YYYY-MM-DD */
  downloaded: string;
  /** Cut [from, to] in seconds. */
  trim?: [number, number];
  gainDb?: number;
}

export const AUDIO_SOURCES: AudioSource[] = [];
