import type { GameData, Item, Rarity, StatId } from "../../data/schema";
import { itemStatAt } from "../../sim";
import { el } from "./dom";
import { type Lang, type MessageKey, t } from "./i18n";
import { statLabel, statValue } from "./item-lines";

export type LineTone = "plain" | "better" | "worse" | "effect" | "temp";

export interface TooltipInfo {
  name: string;
  rarity: Rarity;
  /** "Rare · Head · level 2". */
  sub: string;
  lines: { text: string; tone: LineTone }[];
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
 * from chests; the stat rows show the numbers at `level + temp`. With `compare` (the worn item) every row says
 * how it differs, and rows only the worn item has are listed as lost.
 */
export function tooltipLines(
  lang: Lang, data: GameData, item: Item, level: number, temp: number, compare?: { item: Item; level: number },
): TooltipInfo {
  const step = data.rules.gear.levelStep;
  const total = Math.max(1, level + temp);
  const lines: TooltipInfo["lines"] = [];
  const other = new Map<StatId, number>();
  if (compare) {
    for (const row of compare.item.stats) {
      other.set(row.stat, (other.get(row.stat) ?? 0) + itemStatAt(row.value, compare.level, step));
    }
  }
  for (const row of item.stats) {
    const value = itemStatAt(row.value, total, step);
    const base = `${statValue(row.stat, value)} ${statLabel(lang, row.stat)}`;
    if (!compare) {
      lines.push({ text: base, tone: "plain" });
      continue;
    }
    const diff = value - (other.get(row.stat) ?? 0);
    other.delete(row.stat);
    if (Math.abs(diff) < 1e-9) lines.push({ text: base, tone: "plain" });
    else lines.push({ text: `${base} ${delta(row.stat, diff)}`, tone: diff > 0 ? "better" : "worse" });
  }
  for (const [stat, value] of other) {
    lines.push({ text: `${statValue(stat, 0)} ${statLabel(lang, stat)} ${delta(stat, -value)}`, tone: "worse" });
  }
  if (temp > 0) lines.push({ text: tempLine(lang, temp), tone: "temp" });
  const bosses = data.rules.drops
    .filter((drop) => drop.weights[item.rarity] !== undefined)
    .map((drop) => data.enemies.find((enemy) => enemy.id === drop.boss)?.name[lang])
    .filter((name): name is string => name !== undefined);
  return {
    name: item.name[lang],
    rarity: item.rarity,
    sub: [
      t(lang, `rarity.${item.rarity}` as MessageKey),
      t(lang, `slot.${item.slotType}` as MessageKey),
      level > 0 ? t(lang, "tooltip.level", { n: level }) : t(lang, "tooltip.runOnly"),
    ].join(" · "),
    lines,
    source: bosses.length > 0 ? t(lang, "tooltip.source", { names: bosses.join(", ") }) : "",
  };
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
    for (const line of info.lines) el("div", `tooltip-line ${line.tone}`, root, line.text);
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
