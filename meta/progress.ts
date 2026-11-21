import { DIFFICULTY_IDS, type DifficultyId, type GameData } from "../data/schema";

/** The best result of one world and difficulty: a win, or the phase the run reached (1-20, 21 is the finale). */
export interface CourseResult {
  won: boolean;
  phase: number;
}

/**
 * The world ladder between runs (spec 2026-11-21 4.3), shared by all heroes. Only best results are stored;
 * what is unlocked is derived from them.
 */
export interface ProgressData {
  version: 1;
  /** courseKey to the best result. */
  best: Record<string, CourseResult>;
}

const FINALE_PHASE = 21;

export function courseKey(world: number, difficulty: DifficultyId): string {
  return `${world}-${difficulty}`;
}

export function emptyProgress(): ProgressData {
  return { version: 1, best: {} };
}

function won(progress: ProgressData, world: number, difficulty: DifficultyId): boolean {
  return progress.best[courseKey(world, difficulty)]?.won === true;
}

/**
 * World 1 on normal is always open; world N > 1 opens with a win of world N - 1 on the same difficulty; world 1 of
 * a harder difficulty opens with a win of the last world on the difficulty below it.
 */
export function isUnlocked(progress: ProgressData, world: number, difficulty: DifficultyId, worldCount: number): boolean {
  if (!Number.isInteger(world) || world < 1 || world > worldCount) return false;
  if (world > 1) return won(progress, world - 1, difficulty);
  const rank = DIFFICULTY_IDS.indexOf(difficulty);
  if (rank <= 0) return rank === 0;
  return won(progress, worldCount, DIFFICULTY_IDS[rank - 1]!);
}

function better(a: CourseResult, b: CourseResult): boolean {
  if (a.won !== b.won) return a.won;
  return a.phase > b.phase;
}

/** A new progress with `result` stored when it beats the stored one (a win beats a loss, else the higher phase). */
export function recordResult(
  progress: ProgressData, world: number, difficulty: DifficultyId, result: CourseResult,
): ProgressData {
  const key = courseKey(world, difficulty);
  const old = progress.best[key];
  if (old !== undefined && !better(result, old)) return progress;
  return { version: 1, best: { ...progress.best, [key]: { won: result.won, phase: result.phase } } };
}

/** The course itself when it is open, else world 1 on normal (for URL parameters). */
export function firstUnlocked(
  progress: ProgressData, world: number, difficulty: DifficultyId, worldCount: number,
): { world: number; difficulty: DifficultyId } {
  return isUnlocked(progress, world, difficulty, worldCount) ? { world, difficulty } : { world: 1, difficulty: "normal" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const KEY = /^(\d+)-([a-z]+)$/;

/**
 * Reads saved progress of any shape and never throws. Entries with an unknown key, a world outside the data, an
 * unknown difficulty, a phase that is not a whole number from 1 to 21 or a `won` that is not a boolean are left
 * out and counted in `dropped`. `null` or `undefined` gives empty progress with nothing dropped; anything that is
 * not progress of version 1 gives empty progress and counts as one dropped entry.
 */
export function parseProgress(raw: unknown, data: GameData): { progress: ProgressData; dropped: number } {
  const progress = emptyProgress();
  if (raw === null || raw === undefined) return { progress, dropped: 0 };
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.best)) return { progress, dropped: 1 };
  let dropped = 0;
  for (const [key, value] of Object.entries(raw.best)) {
    const match = KEY.exec(key);
    const world = match ? Number(match[1]) : 0;
    const difficulty = match?.[2] ?? "";
    const ok = match !== null && world >= 1 && world <= data.worlds.length
      && (DIFFICULTY_IDS as readonly string[]).includes(difficulty)
      && isRecord(value) && typeof value.won === "boolean"
      && typeof value.phase === "number" && Number.isInteger(value.phase) && value.phase >= 1 && value.phase <= FINALE_PHASE;
    if (!ok) {
      dropped++;
      continue;
    }
    const result = value as unknown as CourseResult;
    const canonical = courseKey(world, difficulty as DifficultyId);
    const old = progress.best[canonical];
    if (old === undefined || better(result, old)) progress.best[canonical] = { won: result.won, phase: result.phase };
  }
  return { progress, dropped };
}
