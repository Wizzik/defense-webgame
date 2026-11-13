import type { GameData } from "../../data/schema";
import { applyDrop, type Drop, emptySave, equip, parseSave, rollDrop, type SaveData, toLoadout, unequip } from "../../meta";
import type { LoadoutEntry, SlotId } from "../../sim";
import type { SaveBackend } from "./save-store";

/**
 * The player's gear while the page is open: the collection and the dolls (`save`), the drops of the current run,
 * and the writing of every change to the backend. With `persistent` false nothing is written (a debugging
 * session, a browser without storage, or a write that failed).
 */
export class GearSession {
  save: SaveData;
  persistent: boolean;
  /** What the bosses of the current run dropped, in order. */
  drops: Drop[] = [];
  /** Entries of the stored data that did not fit the game data and were left out. */
  readonly droppedOnLoad: number;
  private readonly data: GameData;
  private readonly backend: SaveBackend | null;
  private pending: Promise<void> = Promise.resolve();

  private constructor(data: GameData, backend: SaveBackend | null, save: SaveData, persistent: boolean, dropped: number) {
    this.data = data;
    this.backend = backend;
    this.save = save;
    this.persistent = persistent;
    this.droppedOnLoad = dropped;
  }

  /** Reads the stored gear. A missing backend or one that cannot be read gives an empty collection that is not saved. */
  static async load(data: GameData, backend: SaveBackend | null, options: { persistent?: boolean } = {}): Promise<GearSession> {
    if (!backend) return new GearSession(data, null, emptySave(), false, 0);
    try {
      const { save, dropped } = parseSave(await backend.read(), data);
      return new GearSession(data, backend, save, options.persistent ?? true, dropped);
    } catch {
      return new GearSession(data, backend, emptySave(), false, 0);
    }
  }

  /** Resolves when everything changed so far is written (or the writing gave up). */
  flushed(): Promise<void> {
    return this.pending;
  }

  private commit(save: SaveData): void {
    if (save === this.save) return;
    this.save = save;
    if (!this.persistent || !this.backend) return;
    const backend = this.backend;
    this.pending = this.pending
      .then(() => backend.write(save))
      .catch(() => {
        this.persistent = false;
      });
  }

  /** A new run starts: its list of drops is empty. */
  startRun(): void {
    this.drops = [];
  }

  /** A boss fell: its drop goes into the collection at once, so it is kept even when the run is lost. */
  onBossDeath(bossId: string, seed: number, order: number): Drop {
    const drop = rollDrop(this.data, this.save, bossId, seed, order);
    this.drops.push(drop);
    this.commit(applyDrop(this.save, drop));
    return drop;
  }

  loadout(heroId: string): LoadoutEntry[] {
    return toLoadout(this.save, this.data, heroId);
  }

  equip(heroId: string, itemId: string): void {
    this.commit(equip(this.save, this.data, heroId, itemId));
  }

  unequip(heroId: string, slot: SlotId): void {
    this.commit(unequip(this.save, heroId, slot));
  }

  /** For debugging: puts an item into the collection at a level (clamped to the top level). Unknown items are ignored. */
  grant(itemId: string, level: number): void {
    if (!this.data.items.some((item) => item.id === itemId)) return;
    const clamped = Math.max(1, Math.min(this.data.rules.gear.maxPermanentLevel, Math.round(level)));
    this.commit({ ...this.save, items: { ...this.save.items, [itemId]: clamped } });
  }

  /** For debugging: an empty collection and empty dolls. */
  clear(): void {
    this.commit(emptySave());
  }

  /** The save as text for a file. */
  exportText(): string {
    return JSON.stringify(this.save, null, 2);
  }

  /**
   * Replaces the gear by an exported file's text. Text that is not a save of version 1 is refused and nothing
   * changes; entries of a save that do not fit the game data are left out and counted in `dropped`.
   */
  importText(text: string): { ok: true; dropped: number } | { ok: false; reason: "invalid" } {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, reason: "invalid" };
    }
    if (typeof raw !== "object" || raw === null || (raw as { version?: unknown }).version !== 1) {
      return { ok: false, reason: "invalid" };
    }
    const { save, dropped } = parseSave(raw, this.data);
    this.commit(save);
    return { ok: true, dropped };
  }
}
