import type { Item, StatId } from "../../data/schema";
import { itemStatAt } from "../../sim";
import { type Lang, type MessageKey, t } from "./i18n";

/** Stats whose values are shares shown as percent. */
const PERCENT_STATS: ReadonlySet<StatId> = new Set(["damage", "attackSpeed", "moveSpeed", "spellPower", "goldFind"]);

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

/** One line per stat row of an item at an item level: "+14 Strength", "+6 % move speed". */
export function itemLines(lang: Lang, item: Item, level: number, levelStep: number): string[] {
  return item.stats.map((row) => `${statValue(row.stat, itemStatAt(row.value, level, levelStep))} ${statLabel(lang, row.stat)}`);
}
