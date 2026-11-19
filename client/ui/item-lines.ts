import type { Item, Rules, StatId } from "../../data/schema";
import { itemStatAt } from "../../sim";
import { type Lang, type MessageKey, t } from "./i18n";

/** Stats whose values are shares shown as percent. */
const PERCENT_STATS: ReadonlySet<StatId> = new Set(["damage", "attackSpeed", "moveSpeed", "spellPower", "goldFind", "magicFind", "lifesteal"]);

/** Whole numbers stay whole; anything else gets one decimal. */
function num(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Name of a stat as it follows a number: "Strength", "move speed". */
export function statLabel(lang: Lang, stat: StatId): string {
  return t(lang, `gear.stat.${stat}` as MessageKey);
}

/** "+14", "+1.5" or "+6 %" for a stat value. */
export function statValue(stat: StatId, value: number): string {
  return PERCENT_STATS.has(stat) ? `+${num(value * 100)} %` : `+${num(value)}`;
}

/** The stat rows of an item with permanent level `base` and chest levels `temp`, as "+14 Strength". */
export function itemLines(lang: Lang, item: Item, base: number, temp: number, gear: Rules["gear"]): string[] {
  return item.stats.map((row) => `${statValue(row.stat, itemStatAt(row.value, base, temp, gear))} ${statLabel(lang, row.stat)}`);
}
