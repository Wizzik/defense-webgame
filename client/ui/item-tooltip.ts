import type { GameData, Item, Rarity, StatId } from "../../data/schema";
import { rowTier } from "../../meta";
import { itemStatAt } from "../../sim";
import { el } from "./dom";
import { type Lang, type MessageKey, t } from "./i18n";
import { statLabel, statValue } from "./item-lines";
import { statIconSvg } from "./stat-icons";

export type LineTone = "plain" | "better" | "worse" | "effect" | "temp";

/**
 * One row of an item's text. `stat`: the row's stat, drawn as its icon at the start (stat-icons.ts); none for an
 * effect or a chest-level line. `tier`: 1-4 for a rolled affix row (a small square in the tier colour), else none.
 */
export interface ItemLine {
  text: string;
  tone: LineTone;
  stat?: StatId;
  tier?: number;
}

export interface TooltipInfo {
  name: string;
  rarity: Rarity;
  /** "Rare · Head · level 2". */
  sub: string;
  lines: ItemLine[];
  /** "Drops from: …"; empty when no boss drops the rarity. */
  source: string;
}

/** "(+4)" or "(−4.2)" after a stat row, in the stat's own format. */
function delta(stat: StatId, diff: number): string {
  const text = statValue(stat, Math.abs(diff)).slice(1);
  return diff > 0 ? `(+${text})` : `(−${text})`;
}

function tempLine(lang: Lang, temp: number): string {
  const form = temp === 1 ? "one" : temp < 5 ? "few" : "many";
  return t(lang, `tooltip.temp.${form}` as MessageKey, { n: temp });
}

/**
 * The text of an item's tooltip. `level` is the permanent level (0 for an item a chest gave), `temp` the levels
 * from chests; the stat rows show the numbers with both (itemStatAt). With `compare` (the worn item) every row says
 * how it differs, and rows only the worn item has are listed as lost. A special effect gets one line after the stats.
 */
export function tooltipLines(
  lang: Lang, data: GameData, item: Item, level: number, temp: number,
  compare?: { item: Item; level: number; temp?: number },
): TooltipInfo {
  const gear = data.rules.gear;
  const lines: TooltipInfo["lines"] = [];
  const other = new Map<StatId, number>();
  if (compare) {
    for (const row of compare.item.stats) {
      other.set(row.stat, (other.get(row.stat) ?? 0) + itemStatAt(row.value, compare.level, compare.temp ?? 0, gear));
    }
  }
  item.stats.forEach((row, r) => {
    const value = itemStatAt(row.value, level, temp, gear);
    const base = `${statValue(row.stat, value)} ${statLabel(lang, row.stat)}`;
    const tier = rowTier(item, r);
    const mark = tier > 0 ? { stat: row.stat, tier } : { stat: row.stat };
    if (!compare) {
      lines.push({ text: base, tone: "plain", ...mark });
      return;
    }
    const diff = value - (other.get(row.stat) ?? 0);
    other.delete(row.stat);
    if (Math.abs(diff) < 1e-9) lines.push({ text: base, tone: "plain", ...mark });
    else lines.push({ text: `${base} ${delta(row.stat, diff)}`, tone: diff > 0 ? "better" : "worse", ...mark });
  });
  for (const [stat, value] of other) {
    lines.push({ text: `${statValue(stat, 0)} ${statLabel(lang, stat)} ${delta(stat, -value)}`, tone: "worse", stat });
  }
  if (item.effect) lines.push({ text: item.effect.text[lang], tone: "effect" });
  if (temp > 0) lines.push({ text: tempLine(lang, temp), tone: "temp" });
  const rolled = item.id.startsWith("rolled-");
  const bosses = rolled ? [] : data.rules.drops
    .filter((drop) => drop.weights[item.rarity] !== undefined)
    .map((drop) => data.enemies.find((enemy) => enemy.id === drop.boss)?.name[lang])
    .filter((name): name is string => name !== undefined);
  return {
    name: item.name[lang],
    rarity: item.rarity,
    sub: [
      rolled ? t(lang, "tooltip.random", { rarity: t(lang, `rarity.${item.rarity}` as MessageKey) })
        : t(lang, `rarity.${item.rarity}` as MessageKey),
      t(lang, `slot.${item.slotType}` as MessageKey),
      level > 0 ? t(lang, "tooltip.level", { n: level }) : t(lang, "tooltip.runOnly"),
    ].join(" · "),
    lines,
    source: rolled ? t(lang, "tooltip.sourceRandom")
      : bosses.length > 0 ? t(lang, "tooltip.source", { names: bosses.join(", ") }) : "",
  };
}

/**
 * Dresses a row of item text: the stat's icon before the text and, for a rolled affix row, a small square in the
 * tier colour after it (style.css `.stat-row`, `.tier-mark.tier-N`; Petr, 2026-11-28: a small square, not a "T3" tag).
 */
export function decorateRow(row: HTMLElement, stat: StatId | undefined, tier: number | undefined): void {
  if (stat === undefined && !tier) return;
  row.classList.add("stat-row");
  if (stat !== undefined) row.insertAdjacentHTML("afterbegin", statIconSvg(stat));
  if (tier) {
    const mark = el("span", `tier-mark tier-${tier}`, row);
    mark.title = `Tier ${tier} of 4`;
    mark.setAttribute("aria-label", `Tier ${tier} of 4`);
  }
}

/** One floating tooltip box, shared by the slots of a doll or of the collection. */
export class ItemTooltip {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el("div", "item-tooltip", parent);
    this.root.hidden = true;
  }

  /** Shows the tooltip next to `anchor`, kept inside the window. */
  show(anchor: HTMLElement, info: TooltipInfo): void {
    const root = this.root;
    root.replaceChildren();
    el("div", `tooltip-name rarity-${info.rarity}`, root, info.name);
    el("div", "tooltip-sub", root, info.sub);
    for (const line of info.lines) {
      const row = el("div", `tooltip-line ${line.tone}`, root, line.text);
      decorateRow(row, line.stat, line.tier);
    }
    if (info.source !== "") el("div", "tooltip-source", root, info.source);
    root.hidden = false;
    const box = anchor.getBoundingClientRect();
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    const left = box.right + 10 + width <= innerWidth ? box.right + 10 : Math.max(8, box.left - 10 - width);
    const top = Math.max(8, Math.min(innerHeight - height - 8, box.top));
    root.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
