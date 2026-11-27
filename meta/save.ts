import type { GameData } from "../data/schema";
import { SLOT_IDS, type SlotId, slotTypeOf } from "../sim";
import { type ItemRecord, namedRecord, parseRecord, recordSlotType } from "./item-record";

/**
 * What a player keeps between runs (version 2, random items plan stage 3). `items`: the collection, one record per
 * item (named items once each, rolled items each on their own). `loadouts`: hero id to the uid of the item its doll
 * wears, by slot. `nextUid`: the uid the next new record gets. The collection is shared by all heroes.
 * `rules.loot.collectionLimit` is the size the game keeps to (a drop into a full collection still lands; the gear
 * screen shows at most that many and offers salvage); the reader keeps at most STORED_LIMIT x that, so broken data
 * cannot grow it. `bankGold`: gold of salvaged items, at most `rules.loot.bankLimit`; the next solo run starts with
 * it (meta/salvage.ts).
 */
export interface SaveData {
  version: 2;
  items: ItemRecord[];
  nextUid: number;
  loadouts: Record<string, Partial<Record<SlotId, number>>>;
  bankGold: number;
}

/** The reader keeps at most this many times rules.loot.collectionLimit records. */
const STORED_LIMIT = 2;

export function emptySave(): SaveData {
  return { version: 2, items: [], nextUid: 1, loadouts: {}, bankGold: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The record with `uid`, or undefined. */
export function recordByUid(save: SaveData, uid: number): ItemRecord | undefined {
  return save.items.find((record) => record.uid === uid);
}

/** The record of named item `id`, or undefined when it is not owned. */
export function namedRecordOf(save: SaveData, id: string): ItemRecord | undefined {
  return save.items.find((record) => record.named === id);
}

/** Named item id to its permanent level (the old shape of the collection; the debug snapshot and tests read it). */
export function namedLevels(save: SaveData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const record of save.items) if (record.named !== undefined) out[record.named] = record.level;
  return out;
}

/** Version 1 stored named item id to level and loadouts by item id: every item becomes a named record. */
function migrateV1(raw: Record<string, unknown>, data: GameData): { save: SaveData; dropped: number } {
  const save = emptySave();
  let dropped = 0;
  const maxLevel = data.rules.gear.maxPermanentLevel;
  const uidOf = new Map<string, number>();
  if (isRecord(raw.items)) {
    const stored = raw.items;
    for (const id of Object.keys(stored)) {
      const level = stored[id];
      const ok = typeof level === "number" && Number.isInteger(level) && level >= 1 && level <= maxLevel;
      const record = ok ? namedRecord(data, save.nextUid, id, level) : null;
      if (!record) {
        dropped++;
        continue;
      }
      save.items.push(record);
      uidOf.set(id, record.uid);
      save.nextUid++;
    }
  } else if (raw.items !== undefined && raw.items !== null) {
    dropped++;
  }
  dropped += readLoadouts(raw.loadouts, data, save, (value) => (typeof value === "string" ? uidOf.get(value) : undefined));
  return { save, dropped };
}

/**
 * Fills `save.loadouts` from stored loadouts; `uidOf` turns a stored slot value into the uid of an owned record
 * (undefined: not owned). Returns the entries left out.
 */
function readLoadouts(
  raw: unknown, data: GameData, save: SaveData, uidOf: (value: unknown) => number | undefined,
): number {
  if (raw === undefined || raw === null) return 0;
  if (!isRecord(raw)) return 1;
  let dropped = 0;
  for (const [heroId, loadout] of Object.entries(raw)) {
    if (!data.heroes.some((hero) => hero.id === heroId) || !isRecord(loadout)) {
      dropped++;
      continue;
    }
    for (const slot of Object.keys(loadout)) {
      if (!(SLOT_IDS as readonly string[]).includes(slot)) dropped++;
    }
    const kept: Partial<Record<SlotId, number>> = {};
    const worn = new Set<number>();
    // in slot order, so the result does not depend on the key order of the stored object
    for (let index = 0; index < SLOT_IDS.length; index++) {
      const slot = SLOT_IDS[index]!;
      if (loadout[slot] === undefined) continue;
      const uid = uidOf(loadout[slot]);
      const record = uid === undefined ? undefined : recordByUid(save, uid);
      if (!record || recordSlotType(data, record) !== slotTypeOf(index) || worn.has(record.uid)) {
        dropped++;
        continue;
      }
      kept[slot] = record.uid;
      worn.add(record.uid);
    }
    save.loadouts[heroId] = kept;
  }
  return dropped;
}

/**
 * Reads saved data of any shape and never throws; version 1 (named items by id) turns into named records.
 * Everything that does not fit the game data is left out and counted in `dropped`: records that parseRecord refuses,
 * a uid or a named item stored twice (the first stays), records over the stored limit, unknown heroes and slots,
 * items in a slot of another type, items that are not owned and an item worn twice by one hero.
 * `null` or `undefined` (nothing saved yet) gives an empty save with nothing dropped; data that is not a save of
 * version 1 or 2 gives an empty save and counts as one dropped entry.
 */
export function parseSave(raw: unknown, data: GameData): { save: SaveData; dropped: number } {
  if (raw === null || raw === undefined) return { save: emptySave(), dropped: 0 };
  if (!isRecord(raw)) return { save: emptySave(), dropped: 1 };
  if (raw.version === 1) return migrateV1(raw, data);
  if (raw.version !== 2) return { save: emptySave(), dropped: 1 };
  const save = emptySave();
  let dropped = 0;
  const limit = data.rules.loot.collectionLimit * STORED_LIMIT;
  const uids = new Set<number>();
  const named = new Set<string>();
  let top = 0;
  if (Array.isArray(raw.items)) {
    for (const stored of raw.items) {
      const record = parseRecord(stored, data);
      if (!record || uids.has(record.uid) || (record.named !== undefined && named.has(record.named))
        || save.items.length >= limit) {
        dropped++;
        continue;
      }
      uids.add(record.uid);
      if (record.named !== undefined) named.add(record.named);
      top = Math.max(top, record.uid);
      save.items.push(record);
    }
  } else if (raw.items !== undefined && raw.items !== null) {
    dropped++;
  }
  const next = raw.nextUid;
  save.nextUid = Math.max(top + 1, typeof next === "number" && Number.isInteger(next) ? next : 1);
  dropped += readLoadouts(raw.loadouts, data, save, (value) => (typeof value === "number" && uids.has(value) ? value : undefined));
  // the bank came after the first saves of version 2: a missing one is empty, a broken one counts as dropped
  const bank = raw.bankGold;
  if (typeof bank === "number" && Number.isInteger(bank) && bank >= 0) save.bankGold = Math.min(bank, data.rules.loot.bankLimit);
  else if (bank !== undefined) dropped++;
  return { save, dropped };
}
