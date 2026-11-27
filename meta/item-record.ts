import type { GameData, Item, Rarity, SlotType, StatId } from "../data/schema";
import { RARITIES, STAT_IDS } from "../data/schema";
import { MAX_ROWS, type RolledItem } from "../sim";
import { rolledAsItem } from "./item-view";

/**
 * One item of the collection (random items plan, stage 3): a named item by id, or a rolled item with its base,
 * rarity, rows and effect, stored by value so a later change of the affix numbers does not change an owned item.
 * `uid` tells the records apart (loadouts point to it); a named item is owned once and levels up, a rolled item
 * keeps the level it dropped with.
 */
export interface ItemRecord {
  uid: number;
  rarity: Rarity;
  /** Permanent level, 1 to rules.gear.maxPermanentLevel. */
  level: number;
  /** Id of a named item (data.items). */
  named?: string;
  /** A rolled item: the base id, the rows [stat, value at level 1, tier (-1 for the base's row)], the effect
   *  (index into rules.loot.mythicEffects) and the two-word name (indices into data.loot.names). */
  base?: string;
  rows?: [StatId, number, number][];
  effect?: number;
  name?: [number, number];
}

export function namedRecord(data: GameData, uid: number, id: string, level: number): ItemRecord | null {
  const item = data.items.find((candidate) => candidate.id === id);
  return item ? { uid, rarity: item.rarity, level, named: id } : null;
}

/** A record of a rolled item (as sim/item-roll.ts gives it) at `level`. */
export function rolledRecord(data: GameData, uid: number, rolled: RolledItem, level: number): ItemRecord {
  const record: ItemRecord = {
    uid, rarity: RARITIES[rolled.rarity]!, level, base: data.loot.bases[rolled.base]!.id,
    rows: rolled.stats.map((stat, r) => [STAT_IDS[stat]!, rolled.values[r]!, rolled.tiers[r]!]),
  };
  if (rolled.effect >= 0) record.effect = rolled.effect;
  if (rolled.nameFirst >= 0 && rolled.nameNoun >= 0) record.name = [rolled.nameFirst, rolled.nameNoun];
  return record;
}

/** The rolled item of a record, or null for a named record or one whose base the game no longer has. */
export function rolledOf(data: GameData, record: ItemRecord): RolledItem | null {
  if (record.named !== undefined || record.base === undefined || !record.rows) return null;
  const base = data.loot.bases.findIndex((candidate) => candidate.id === record.base);
  if (base < 0) return null;
  return {
    base,
    rarity: RARITIES.indexOf(record.rarity),
    stats: record.rows.map(([stat]) => STAT_IDS.indexOf(stat)),
    values: record.rows.map(([, value]) => value),
    tiers: record.rows.map(([, , tier]) => tier),
    effect: record.effect ?? -1,
    nameFirst: record.name?.[0] ?? -1,
    nameNoun: record.name?.[1] ?? -1,
  };
}

/** The record as an `Item` (a named item from the catalogue, a rolled one with its own name), or null. */
export function recordItem(data: GameData, record: ItemRecord): Item | null {
  if (record.named !== undefined) return data.items.find((item) => item.id === record.named) ?? null;
  const rolled = rolledOf(data, record);
  return rolled ? rolledAsItem(data, rolled) : null;
}

/** The slot type a record's item takes, or null when the game does not know it. */
export function recordSlotType(data: GameData, record: ItemRecord): SlotType | null {
  return recordItem(data, record)?.slotType ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isIndex = (value: unknown, length: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < length;

/**
 * Reads one stored record of any shape; null when it does not fit the game data (never throws). A named record
 * takes its rarity from the catalogue. A rolled record needs a known base, a rarity, 1 to MAX_ROWS rows of known
 * stats (each once) with finite positive values and tiers -1 to 3; an effect or a name the game does not know is
 * left out and the item kept.
 */
export function parseRecord(raw: unknown, data: GameData): ItemRecord | null {
  if (!isRecord(raw)) return null;
  const { uid, level } = raw;
  if (typeof uid !== "number" || !Number.isInteger(uid) || uid < 1) return null;
  if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > data.rules.gear.maxPermanentLevel) {
    return null;
  }
  if (raw.named !== undefined) return typeof raw.named === "string" ? namedRecord(data, uid, raw.named, level) : null;
  if (typeof raw.base !== "string" || !data.loot.bases.some((b) => b.id === raw.base)) return null;
  if (typeof raw.rarity !== "string" || !(RARITIES as readonly string[]).includes(raw.rarity)) return null;
  if (!Array.isArray(raw.rows) || raw.rows.length < 1 || raw.rows.length > MAX_ROWS) return null;
  const rows: [StatId, number, number][] = [];
  const seen = new Set<string>();
  for (const row of raw.rows) {
    if (!Array.isArray(row) || row.length !== 3) return null;
    const [stat, value, tier] = row as unknown[];
    if (typeof stat !== "string" || !(STAT_IDS as readonly string[]).includes(stat) || seen.has(stat)) return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
    if (typeof tier !== "number" || !Number.isInteger(tier) || tier < -1 || tier > 3) return null;
    seen.add(stat);
    rows.push([stat as StatId, value, tier]);
  }
  const record: ItemRecord = { uid, rarity: raw.rarity as Rarity, level, base: raw.base, rows };
  if (isIndex(raw.effect, data.rules.loot.mythicEffects.length)) record.effect = raw.effect;
  const slotType = data.loot.bases.find((b) => b.id === raw.base)!.slotType;
  if (Array.isArray(raw.name) && isIndex(raw.name[0], data.loot.names.first.length)
    && isIndex(raw.name[1], data.loot.names.nouns[slotType].length)) {
    record.name = [raw.name[0], raw.name[1]];
  }
  return record;
}
