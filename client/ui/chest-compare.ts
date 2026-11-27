import type { ChestCard, Run } from "../../sim";
import { type CompareSide, compareLines } from "./chest-compare-lines";
import { el } from "./dom";
import { iconSvg } from "./item-icons";
import { type LineTone, tierMark } from "./item-tooltip";
import { type Lang, t } from "./i18n";

/** The arrow after a stat value: which side of the compare is better. */
function arrow(tone: LineTone): string {
  return tone === "better" ? " ▲" : tone === "worse" ? " ▼" : "";
}

/**
 * The compare of a chest Choice card (spec 2026-11-19, 4.5): the worn item one level up on the left, the rolled
 * item on the right, their stat rows lined up, and a button for each (keys 1 keep, 2 take, Escape back).
 */
export class ChestCompare {
  private readonly root: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly cols: HTMLElement;
  private index = -1;
  private readonly onChoose: (index: number, keep: boolean) => void;
  private readonly onBack: () => void;

  constructor(parent: HTMLElement, onChoose: (index: number, keep: boolean) => void, onBack: () => void) {
    this.onChoose = onChoose;
    this.onBack = onBack;
    this.root = el("div", "chest-compare", parent);
    this.root.id = "chest-compare";
    this.root.hidden = true;
    const head = el("div", "compare-head", this.root);
    this.back = el("button", "compare-back", head);
    this.back.addEventListener("click", () => this.onBack());
    this.cols = el("div", "compare-cols", this.root);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  /** The card index being compared, or null. */
  get comparing(): number | null {
    return this.open ? this.index : null;
  }

  show(run: Run, card: ChestCard, index: number, lang: Lang): void {
    this.index = index;
    const info = compareLines(lang, run.data, run.gear, card);
    this.back.replaceChildren();
    el("span", "compare-esc", this.back, "Esc");
    el("span", "", this.back, t(lang, "chest.back"));
    this.cols.replaceChildren();
    const keep = this.column(info.keep, "keep", t(lang, "chest.keep"), "1");
    const take = this.column(info.take, "take", t(lang, "chest.take"), "2");
    for (const row of info.rows) {
      this.row(keep.rows, row.keep, row.keepTone, "", row.keep === "" ? 0 : row.keepTier);
      this.row(take.rows, row.take, row.takeTone, row.takeNew ? ` ${t(lang, "chest.statNew")}` : "", row.take === "" ? 0 : row.takeTier);
    }
    this.effect(keep.col, info.keep.effect);
    this.effect(take.col, info.take.effect);
    keep.col.appendChild(keep.button);
    take.col.appendChild(take.button);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.index = -1;
  }

  /** Handles a key while the compare is open; returns whether it was used. */
  key(code: string): boolean {
    if (!this.open) return false;
    if (code === "Digit1" || code === "Numpad1") this.onChoose(this.index, true);
    else if (code === "Digit2" || code === "Numpad2") this.onChoose(this.index, false);
    else if (code === "Escape") this.onBack();
    else return false;
    return true;
  }

  private column(side: CompareSide, kind: "keep" | "take", label: string, key: string) {
    const col = el("div", `card chest compare-col compare-${kind} rarity-${side.rarity}`, this.cols);
    el("span", "compare-label", col, label);
    const head = el("span", "chest-head", col);
    const glyph = el("span", "chest-glyph", head);
    glyph.innerHTML = iconSvg(side.slotType);
    el("span", "card-name", head, side.title);
    el("span", "chest-rarity", col, side.rarityName);
    el("span", "card-desc", col, side.level);
    const rows = el("div", "compare-rows", col);
    const button = el("button", `compare-button compare-${kind}-button`);
    el("span", "compare-key", button, key);
    el("span", "", button, label);
    button.addEventListener("click", () => this.onChoose(this.index, kind === "keep"));
    return { col, rows, button };
  }

  private row(parent: HTMLElement, text: string, tone: LineTone, note: string, tier: number): void {
    // an empty row keeps its height, so the rows of both columns stay level
    const row = el("span", `compare-row tooltip-line ${tone}`, parent, text === "" ? " " : `${text}${arrow(tone)}${note}`);
    if (tier > 0) tierMark(row, tier);
  }

  /** The effect band is always there (empty without an effect), so both columns have the same grid bands. */
  private effect(parent: HTMLElement, text: string | null): void {
    el("span", "compare-effect tooltip-line effect", parent, text ?? "");
  }
}
