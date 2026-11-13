import type { GameData, SlotType, StatId } from "../data/schema";
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

/** One permanent item a hero wears into a run. */
export interface LoadoutEntry {
  slot: SlotId;
  /** Item id. */
  item: string;
  /** Permanent level, 1 to `rules.gear.maxPermanentLevel`. */
  level: number;
}

/** Sum of the worn items' stats; `heroStats` reads it. Shares are fractions (0.05 = 5 %). */
export type GearBonus = Record<StatId, number>;

export function emptyGearBonus(): GearBonus {
  return {
    str: 0, agi: 0, int: 0, hp: 0, armor: 0, regen: 0,
    damage: 0, attackSpeed: 0, moveSpeed: 0, spellPower: 0, magnet: 0, goldFind: 0,
  };
}

/** What the hero wears in the run: one entry per slot. */
export class GearState {
  /** Index into `data.items`; -1 for an empty slot. */
  readonly item = new Int16Array(SLOT_COUNT).fill(-1);
  /** Permanent level from the loadout; 0 for an empty slot or an item a chest gave. */
  readonly base = new Uint8Array(SLOT_COUNT);
  /** Levels added by chests in this run. */
  readonly temp = new Uint16Array(SLOT_COUNT);
}

/** An item number at an item level: value x (1 + levelStep x (level - 1)). */
export function itemStatAt(value: number, level: number, levelStep: number): number {
  return value * (1 + levelStep * (level - 1));
}

/** Index in `data.items` of the common item of a slot type (the one a chest puts into an empty slot). */
export function basicItemIndex(data: GameData, type: SlotType): number {
  const index = data.items.findIndex((item) => item.rarity === "common" && item.slotType === type);
  if (index < 0) throw new Error(`gear: no common item of type ${type}`);
  return index;
}

/** Puts the valid entries of a loadout into the gear slots. An entry that does not fit is skipped. */
export function loadGear(run: Run, loadout: readonly LoadoutEntry[]): void {
  const { data, gear } = run;
  const maxLevel = data.rules.gear.maxPermanentLevel;
  for (const entry of loadout) {
    const slot = SLOT_IDS.indexOf(entry.slot);
    if (slot < 0 || gear.item[slot] >= 0) continue;
    const index = data.items.findIndex((item) => item.id === entry.item);
    if (index < 0 || data.items[index]!.slotType !== slotTypeOf(slot)) continue;
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > maxLevel) continue;
    // A player owns one piece of an item, so it is worn in one slot only.
    if (gear.item.includes(index)) continue;
    gear.item[slot] = index;
    gear.base[slot] = entry.level;
  }
}

/** Sums the worn items into `hero.gear` and refreshes the hero's stats. Called at the start and after a chest pick. */
export function recomputeGear(run: Run): void {
  const { data, gear, hero } = run;
  const bonus = hero.gear;
  bonus.str = 0;
  bonus.agi = 0;
  bonus.int = 0;
  bonus.hp = 0;
  bonus.armor = 0;
  bonus.regen = 0;
  bonus.damage = 0;
  bonus.attackSpeed = 0;
  bonus.moveSpeed = 0;
  bonus.spellPower = 0;
  bonus.magnet = 0;
  bonus.goldFind = 0;
  const step = data.rules.gear.levelStep;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const index = gear.item[slot]!;
    if (index < 0) continue;
    const level = gear.base[slot]! + gear.temp[slot]!;
    const stats = data.items[index]!.stats;
    for (let k = 0; k < stats.length; k++) {
      const row = stats[k]!;
      bonus[row.stat] += itemStatAt(row.value, level, step);
    }
  }
  refreshHeroStats(run);
}
