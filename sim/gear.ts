import type { GameData, Rules, SlotType, StatId } from "../data/schema";
import { RARITIES, STAT_IDS } from "../data/schema";
import { GearFx, loadEffects } from "./gear-effects";
import { refreshHeroStats } from "./level-up";
import type { Run } from "./run";

/** The 16 gear slots of a hero; the index in this list is the slot number everywhere in the simulation. */
export const SLOT_IDS = [
  "head", "neck", "shoulders", "back", "chest", "wrist", "hands", "waist", "legs", "feet",
  "ring1", "ring2", "trinket1", "trinket2", "mainHand", "offHand",
] as const;
export type SlotId = (typeof SLOT_IDS)[number];
export const SLOT_COUNT = 16;

const SLOT_TYPES: readonly SlotType[] = [
  "head", "neck", "shoulders", "back", "chest", "wrist", "hands", "waist", "legs", "feet",
  "ring", "ring", "trinket", "trinket", "mainHand", "offHand",
];

/** The item type a slot takes. */
export function slotTypeOf(slot: number): SlotType {
  return SLOT_TYPES[slot]!;
}

/** One permanent item a hero wears into a run: a named item by id, or a rolled one (random items). */
export interface LoadoutEntry {
  slot: SlotId;
  /** Item id of a named item; for a rolled item any text (meta writes "rolled-<base id>"), `rolled` decides. */
  item: string;
  /** Permanent level, 1 to `rules.gear.maxPermanentLevel`. */
  level: number;
  /** The rolled item, when the entry is one. */
  rolled?: RolledItem;
}

/** Sum of the worn items' stats; `heroStats` reads it. Shares are fractions (0.05 = 5 %). */
export type GearBonus = Record<StatId, number>;

export function emptyGearBonus(): GearBonus {
  const bonus = {} as GearBonus;
  for (let k = 0; k < STAT_IDS.length; k++) bonus[STAT_IDS[k]!] = 0;
  return bonus;
}

/** `GearState.item` of an empty slot, and of a slot that wears a rolled (random) item. */
export const EMPTY_ITEM = -1;
export const ROLLED_ITEM = -2;
/** Rows of a rolled item at most: the base's implicit row and up to four affixes. */
export const MAX_ROWS = 5;

/**
 * A rolled item (spec 2026-11-26 random items): a base, a rarity and stat rows at item level 1. Allocated only with
 * a chest offer (and between runs); in the run the rows live in the typed arrays of `GearState`.
 */
export interface RolledItem {
  /** Index into `data.loot.bases`. */
  base: number;
  /** Index into RARITIES. */
  rarity: number;
  /** Per row: index into STAT_IDS, value at item level 1, tier 0-3 (-1 for the base's implicit row, the first). */
  stats: number[];
  values: number[];
  tiers: number[];
  /** Index into `rules.loot.mythicEffects`, or -1. */
  effect: number;
  /** Two-word name of an item with three or more affixes: indices into `data.loot.names` (first word, noun of the slot type); else -1. */
  nameFirst: number;
  nameNoun: number;
}

/** What the hero wears in the run: one entry per slot. */
export class GearState {
  /** Index into `data.items` of a named item; EMPTY_ITEM, or ROLLED_ITEM for a rolled item (its rows below). */
  readonly item = new Int16Array(SLOT_COUNT).fill(EMPTY_ITEM);
  /** A rolled item: base index, rarity index, effect index (-1 none), rare-name indices and rows (see RolledItem). */
  readonly rolledBase = new Int16Array(SLOT_COUNT).fill(-1);
  readonly rolledRarity = new Int8Array(SLOT_COUNT);
  readonly rolledEffect = new Int8Array(SLOT_COUNT).fill(-1);
  readonly nameFirst = new Int8Array(SLOT_COUNT).fill(-1);
  readonly nameNoun = new Int8Array(SLOT_COUNT).fill(-1);
  readonly rowCount = new Uint8Array(SLOT_COUNT);
  /** Row r of slot s at s x MAX_ROWS + r. */
  readonly rowStat = new Int8Array(SLOT_COUNT * MAX_ROWS);
  readonly rowValue = new Float64Array(SLOT_COUNT * MAX_ROWS);
  readonly rowTier = new Int8Array(SLOT_COUNT * MAX_ROWS);
  /** Permanent level from the loadout; 0 for an empty slot or an item a chest gave. */
  readonly base = new Uint8Array(SLOT_COUNT);
  /** Levels added by chests in this run. */
  readonly temp = new Uint16Array(SLOT_COUNT);
  /** Special effects of the worn items and their counters (sim/gear-effects.ts). */
  readonly fx: GearFx;

  constructor(maxEnemies = 0) {
    this.fx = new GearFx(maxEnemies);
  }
}

/**
 * An item number with permanent level `base` and chest levels `temp`:
 * value x (1 + levelStep x max(base - 1, 0) + chestLevelStep x temp). An item a chest gave has base 0.
 */
export function itemStatAt(value: number, base: number, temp: number, gear: Rules["gear"]): number {
  return value * (1 + gear.levelStep * Math.max(base - 1, 0) + gear.chestLevelStep * temp);
}

/** Puts a rolled item into slot `slot` (the caller sets its levels). */
export function wearRolled(gear: GearState, slot: number, rolled: RolledItem): void {
  gear.item[slot] = ROLLED_ITEM;
  gear.rolledBase[slot] = rolled.base;
  gear.rolledRarity[slot] = rolled.rarity;
  gear.rolledEffect[slot] = rolled.effect;
  gear.nameFirst[slot] = rolled.nameFirst;
  gear.nameNoun[slot] = rolled.nameNoun;
  const count = Math.min(rolled.stats.length, MAX_ROWS);
  gear.rowCount[slot] = count;
  for (let r = 0; r < MAX_ROWS; r++) {
    const at = slot * MAX_ROWS + r;
    gear.rowStat[at] = r < count ? rolled.stats[r]! : 0;
    gear.rowValue[at] = r < count ? rolled.values[r]! : 0;
    gear.rowTier[at] = r < count ? rolled.tiers[r]! : 0;
  }
}

/** Puts named item `item` (index into `data.items`) into slot `slot` and clears the rolled fields. */
export function wearNamed(gear: GearState, slot: number, item: number): void {
  gear.item[slot] = item;
  gear.rolledBase[slot] = -1;
  gear.rolledRarity[slot] = 0;
  gear.rolledEffect[slot] = -1;
  gear.nameFirst[slot] = -1;
  gear.nameNoun[slot] = -1;
  gear.rowCount[slot] = 0;
}

/** The rolled item a slot wears as a new object (tests, the client and saves; allocates), or null. */
export function rolledAt(gear: GearState, slot: number): RolledItem | null {
  if (gear.item[slot] !== ROLLED_ITEM) return null;
  const stats: number[] = [];
  const values: number[] = [];
  const tiers: number[] = [];
  for (let r = 0; r < gear.rowCount[slot]!; r++) {
    stats.push(gear.rowStat[slot * MAX_ROWS + r]!);
    values.push(gear.rowValue[slot * MAX_ROWS + r]!);
    tiers.push(gear.rowTier[slot * MAX_ROWS + r]!);
  }
  return {
    base: gear.rolledBase[slot]!, rarity: gear.rolledRarity[slot]!, stats, values, tiers,
    effect: gear.rolledEffect[slot]!, nameFirst: gear.nameFirst[slot]!, nameNoun: gear.nameNoun[slot]!,
  };
}

/** Rarity rank (common 0 .. mythic 4) of what slot `slot` wears; -1 for an empty slot. */
export function wornRarity(data: GameData, gear: GearState, slot: number): number {
  const index = gear.item[slot]!;
  if (index === EMPTY_ITEM) return -1;
  if (index === ROLLED_ITEM) return gear.rolledRarity[slot]!;
  return RARITIES.indexOf(data.items[index]!.rarity);
}

/** Index in `data.items` of the common item of a slot type (the one a chest puts into an empty slot). */
export function basicItemIndex(data: GameData, type: SlotType): number {
  const index = data.items.findIndex((item) => item.rarity === "common" && item.slotType === type);
  if (index < 0) throw new Error(`gear: no common item of type ${type}`);
  return index;
}

/** Puts the valid entries of a loadout (named or rolled) into the gear slots. An entry that does not fit is skipped. */
export function loadGear(run: Run, loadout: readonly LoadoutEntry[]): void {
  const { data, gear } = run;
  const maxLevel = data.rules.gear.maxPermanentLevel;
  for (const entry of loadout) {
    const slot = SLOT_IDS.indexOf(entry.slot);
    if (slot < 0 || gear.item[slot] !== EMPTY_ITEM) continue;
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > maxLevel) continue;
    if (entry.rolled) {
      if (!rolledFits(data, entry.rolled, slot)) continue;
      wearRolled(gear, slot, entry.rolled);
      gear.base[slot] = entry.level;
      continue;
    }
    const index = data.items.findIndex((item) => item.id === entry.item);
    if (index < 0 || data.items[index]!.slotType !== slotTypeOf(slot)) continue;
    // A player owns one piece of an item, so it is worn in one slot only.
    if (gear.item.includes(index)) continue;
    wearNamed(gear, slot, index);
    gear.base[slot] = entry.level;
  }
}

/** Whether a rolled item of a loadout is sound for `slot`: a base of the slot's type, a rarity, rows of known stats. */
function rolledFits(data: GameData, rolled: RolledItem, slot: number): boolean {
  const base = data.loot.bases[rolled.base];
  if (!base || base.slotType !== slotTypeOf(slot)) return false;
  if (!Number.isInteger(rolled.rarity) || rolled.rarity < 0 || rolled.rarity >= RARITIES.length) return false;
  const rows = rolled.stats.length;
  if (rows < 1 || rows > MAX_ROWS || rolled.values.length !== rows || rolled.tiers.length !== rows) return false;
  for (let r = 0; r < rows; r++) {
    const stat = rolled.stats[r]!;
    if (!Number.isInteger(stat) || stat < 0 || stat >= STAT_IDS.length || !Number.isFinite(rolled.values[r]!)) return false;
  }
  const effects = data.rules.loot.mythicEffects.length;
  return Number.isInteger(rolled.effect) && rolled.effect >= -1 && rolled.effect < effects;
}

/** Sums the worn items into `hero.gear` and refreshes the hero's stats. Called at the start and after a chest pick. */
export function recomputeGear(run: Run): void {
  const { data, gear, hero } = run;
  const bonus = hero.gear;
  for (let k = 0; k < STAT_IDS.length; k++) bonus[STAT_IDS[k]!] = 0;
  const rules = data.rules.gear;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const index = gear.item[slot]!;
    if (index === EMPTY_ITEM) continue;
    const base = gear.base[slot]!;
    const temp = gear.temp[slot]!;
    if (index === ROLLED_ITEM) {
      for (let r = 0; r < gear.rowCount[slot]!; r++) {
        const at = slot * MAX_ROWS + r;
        bonus[STAT_IDS[gear.rowStat[at]!]!] += itemStatAt(gear.rowValue[at]!, base, temp, rules);
      }
      continue;
    }
    const stats = data.items[index]!.stats;
    for (let k = 0; k < stats.length; k++) {
      const row = stats[k]!;
      bonus[row.stat] += itemStatAt(row.value, base, temp, rules);
    }
  }
  loadEffects(run);
  refreshHeroStats(run);
}

/** Debug and tests: puts item `item` into gear slot `slot` of the run as a chest item (base 0, chest level 1). */
export function debugWear(run: Run, slot: number, item: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) throw new Error(`debugWear: bad slot ${slot}`);
  if (!run.data.items[item] || slotTypeOf(slot) !== run.data.items[item]!.slotType) {
    throw new Error(`debugWear: item ${item} does not fit slot ${slot}`);
  }
  wearNamed(run.gear, slot, item);
  run.gear.base[slot] = 0;
  run.gear.temp[slot] = 1;
  recomputeGear(run);
}
