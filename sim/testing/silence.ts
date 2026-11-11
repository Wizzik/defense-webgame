// Tests only.
import type { GameData } from "../../data/schema";

/** No pack ever comes: tests that place their own enemies call this before `createRun`. */
export function silenceSpawns(data: GameData): void {
  data.rules.run.firstPackSeconds = 1e9;
}
