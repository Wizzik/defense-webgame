import { DIFFICULTY_IDS, type DifficultyId, type GameData } from "../../data/schema";
import {
  courseKey, type CourseResult, emptyProgress, isUnlocked, parseProgress, type ProgressData, recordResult,
} from "../../meta";
import type { SaveBackend } from "./save-store";

/**
 * The world ladder while the page is open (like GearSession): the best results, what is unlocked, and the writing
 * of every change. With `persistent` false nothing is written; with `unlockAll` (debug) every course is open.
 */
export class ProgressSession {
  progress: ProgressData;
  persistent: boolean;
  readonly droppedOnLoad: number;
  private readonly worldCount: number;
  private readonly unlockAll: boolean;
  private readonly backend: SaveBackend<ProgressData> | null;
  private pending: Promise<void> = Promise.resolve();

  private constructor(
    data: GameData, backend: SaveBackend<ProgressData> | null, progress: ProgressData, persistent: boolean,
    unlockAll: boolean, dropped: number,
  ) {
    this.worldCount = data.worlds.length;
    this.backend = backend;
    this.progress = progress;
    this.persistent = persistent;
    this.unlockAll = unlockAll;
    this.droppedOnLoad = dropped;
  }

  /** Reads the stored progress; a missing backend or one that cannot be read gives empty progress that is not saved. */
  static async load(
    data: GameData, backend: SaveBackend<ProgressData> | null, options: { persistent: boolean; unlockAll: boolean },
  ): Promise<ProgressSession> {
    if (!backend) return new ProgressSession(data, null, emptyProgress(), false, options.unlockAll, 0);
    try {
      const { progress, dropped } = parseProgress(await backend.read(), data);
      return new ProgressSession(data, backend, progress, options.persistent, options.unlockAll, dropped);
    } catch {
      return new ProgressSession(data, backend, emptyProgress(), false, options.unlockAll, 0);
    }
  }

  isUnlocked(world: number, difficulty: DifficultyId): boolean {
    if (this.unlockAll) return Number.isInteger(world) && world >= 1 && world <= this.worldCount;
    return isUnlocked(this.progress, world, difficulty, this.worldCount);
  }

  /** courseKey of every open course, worlds first. */
  unlocked(): string[] {
    const keys: string[] = [];
    for (let world = 1; world <= this.worldCount; world++) {
      for (const difficulty of DIFFICULTY_IDS) if (this.isUnlocked(world, difficulty)) keys.push(courseKey(world, difficulty));
    }
    return keys;
  }

  /** Stores the result of a finished run when it beats the stored one. */
  record(world: number, difficulty: DifficultyId, result: CourseResult): void {
    const next = recordResult(this.progress, world, difficulty, result);
    if (next === this.progress) return;
    this.progress = next;
    if (!this.persistent || !this.backend) return;
    const backend = this.backend;
    this.pending = this.pending
      .then(() => backend.write(next))
      .catch(() => {
        this.persistent = false;
      });
  }

  /** Resolves when everything recorded so far is written (or the writing gave up). */
  flushed(): Promise<void> {
    return this.pending;
  }
}
