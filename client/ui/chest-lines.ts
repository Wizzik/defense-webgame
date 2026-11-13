import type { GameData, Rarity } from "../../data/schema";
import { basicItemIndex, type GearState, itemStatAt, slotTypeOf } from "../../sim";
import { type Lang, type MessageKey, t } from "./i18n";
import { itemLines, statLabel, statValue } from "./item-lines";

/** What a chest card shows for one gear slot. */
export interface ChestLines {
  /** Name of the item the slot holds, or of the common item an empty slot gets. */
  title: string;
  /** Name of the slot's type. */
  slot: string;
  rarity: Rarity;
  /** Level of the slot before and after the pick (permanent + temporary); 0 is an empty slot. */
  from: number;
  to: number;
  /** Stat rows: "+14 → +16.1 Strength", or "+6 % move speed" for a new item. */
  lines: string[];
}

/** The change a chest makes to a slot: a new common item, or one more level of the worn item. */
export function chestLines(lang: Lang, data: GameData, gear: GearState, slot: number): ChestLines {
  const type = slotTypeOf(slot);
  const worn = gear.item[slot]!;
  const item = data.items[worn >= 0 ? worn : basicItemIndex(data, type)]!;
  const from = worn >= 0 ? gear.base[slot]! + gear.temp[slot]! : 0;
  const step = data.rules.gear.levelStep;
  const lines = from === 0
    ? itemLines(lang, item, 1, step)
    : item.stats.map((row) =>
      `${statValue(row.stat, itemStatAt(row.value, from, step))} → ${statValue(row.stat, itemStatAt(row.value, from + 1, step))} ` +
        statLabel(lang, row.stat));
  return { title: item.name[lang], slot: t(lang, `slot.${type}` as MessageKey), rarity: item.rarity, from, to: from + 1, lines };
}
