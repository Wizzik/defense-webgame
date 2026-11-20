import type { Cue } from "../../data/schema/audio";

export interface Variation {
  /** A random recorded variant, or null for a cue that only has a synth fallback. */
  file: string | null;
  rate: number;
  /** Linear gain from the cue's level and its random spread. */
  gain: number;
}

/** Draws a variant, a playback rate and a gain for one play of a cue. */
export function vary(cue: Cue, rand: () => number): Variation {
  const file = cue.files.length > 0 ? cue.files[Math.min(cue.files.length - 1, Math.floor(rand() * cue.files.length))]! : null;
  const rate = 1 + (2 * rand() - 1) * cue.pitchSpread;
  const db = cue.gainDb + (2 * rand() - 1) * cue.gainSpreadDb;
  return { file, rate, gain: 10 ** (db / 20) };
}
