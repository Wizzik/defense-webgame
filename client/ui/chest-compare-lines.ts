import type { GameData, Item, Rarity, SlotType, StatId } from "../../data/schema";
import { rowTier } from "../../meta";
import { type ChestCard, type GearState, itemStatAt } from "../../sim";
import { type Lang, type MessageKey, t } from "./i18n";
import { statLabel, statValue } from "./item-lines";
import type { LineTone } from "./item-tooltip";
import { cardItem, wornItem } from "./rolled-item";

/** One column of the chest compare: an item as it would stand after the choice. */
export interface CompareSide {
  title: string;
  rarity: Rarity;
  rarityName: string;
  slotType: SlotType;
  /** Id of the item (`rolled-<base id>` for a random one), for its icon. */
  itemId: string;
  /** "level 3 → 4" for the kept item, "level 4 for this run" for the new one. */
  level: string;
  /** The special effect of a legendary or mythic item, or null. */
  effect: string | null;
}

/** One stat row of both columns; a side without the stat has "" and the tone "plain". */
export interface CompareRow {
  stat: StatId;
  keep: string;
  take: string;
  keepTone: LineTone;
  takeTone: LineTone;
  /** Only the new item has this stat. */
  takeNew: boolean;
  /** Tier of the row on each side, 1-4 for a rolled affix row (T1-T4), else 0. */
  keepTier: number;
  takeTier: number;
}

export interface CompareLines {
  keep: CompareSide;
  take: CompareSide;
  rows: CompareRow[];
}

/** Each stat of `item` summed at the given levels, in the item's order. */
function statsAt(item: Item, base: number, temp: number, gear: GameData["rules"]["gear"]): Map<StatId, number> {
  const out = new Map<StatId, number>();
  for (const row of item.stats) out.set(row.stat, (out.get(row.stat) ?? 0) + itemStatAt(row.value, base, temp, gear));
  return out;
}

/** The tier of `stat`'s row on `item` (rowTier), 0 when the item has no such row. */
function tierOf(item: Item, stat: StatId): number {
  const row = item.stats.findIndex((r) => r.stat === stat);
  return row < 0 ? 0 : rowTier(item, row);
}

function side(lang: Lang, item: Item, level: string): CompareSide {
  const rarity = t(lang, `rarity.${item.rarity}` as MessageKey);
  return {
    title: item.name[lang],
    rarity: item.rarity,
    rarityName: item.id.startsWith("rolled-") ? t(lang, "tooltip.random", { rarity }) : rarity,
    slotType: item.slotType,
    itemId: item.id,
    level,
    effect: item.effect ? item.effect.text[lang] : null,
  };
}

/** Tone of `value` against `other`; a missing value (undefined) is plain, a missing other loses to any value. */
function tone(value: number | undefined, other: number | undefined): LineTone {
  if (value === undefined) return "plain";
  const diff = value - (other ?? 0);
  if (Math.abs(diff) < 1e-9) return "plain";
  return diff > 0 ? "better" : "worse";
}

/**
 * The two columns of a chest Choice card: keep = the worn item with one chest level more, take = the rolled item
 * with the slot's whole level plus one as chest levels (sim/chests.ts applyChestCard). Rows line up by stat: the
 * worn item's stats first, then the ones only the rolled item has.
 */
export function compareLines(lang: Lang, data: GameData, gear: GearState, card: ChestCard): CompareLines {
  const rules = data.rules.gear;
  const worn = wornItem(data, gear, card.slot)!;
  const rolled = cardItem(data, card);
  const base = gear.base[card.slot]!;
  const temp = gear.temp[card.slot]!;
  const from = base + temp;
  const keepStats = statsAt(worn, base, temp + 1, rules);
  const takeStats = statsAt(rolled, 0, from + 1, rules);
  const stats: StatId[] = [...keepStats.keys()];
  for (const stat of takeStats.keys()) if (!keepStats.has(stat)) stats.push(stat);
  const text = (stat: StatId, value: number | undefined) =>
    value === undefined ? "" : `${statValue(stat, value)} ${statLabel(lang, stat)}`;
  return {
    keep: side(lang, worn, t(lang, "chest.level", { from, to: from + 1 })),
    take: side(lang, rolled, t(lang, "chest.takeLevel", { n: from + 1 })),
    rows: stats.map((stat) => {
      const k = keepStats.get(stat);
      const v = takeStats.get(stat);
      return {
        stat,
        keep: text(stat, k),
        take: text(stat, v),
        keepTone: tone(k, v),
        takeTone: tone(v, k),
        takeNew: k === undefined,
        keepTier: tierOf(worn, stat),
        takeTier: tierOf(rolled, stat),
      };
    }),
  };
}
