import type { GameData, Item } from "../../data/schema";
import { type HeroStats, SLOT_IDS, type SlotId, slotTypeOf } from "../../sim";
import { el, setText } from "./dom";
import { type Lang, type MessageKey, t } from "./i18n";
import { iconSvg } from "./item-icons";
import { type ItemTooltip, tooltipLines } from "./item-tooltip";

/** What one slot of the doll shows. `level` is the permanent level (0 for an item a chest gave), `temp` the levels from chests. */
export interface DollSlotView {
  slot: SlotId;
  item: Item | null;
  level: number;
  temp: number;
}

/** The hero's stats with the gear on, and the attributes with the gear's share. */
export type DollTotals = HeroStats & { str: number; agi: number; int: number };

const LEFT: readonly SlotId[] = ["head", "neck", "shoulders", "back", "chest", "wrist"];
const RIGHT: readonly SlotId[] = ["hands", "waist", "legs", "feet", "ring1", "ring2", "trinket1", "trinket2"];
const BOTTOM: readonly SlotId[] = ["mainHand", "offHand"];

/** A plain figure in blue-grey: the same for every hero, so no hero colour brings orange into the panel. */
const FIGURE =
  '<svg viewBox="0 0 80 150" aria-hidden="true"><circle cx="40" cy="22" r="15"/>' +
  '<path d="M18 46h44l8 52h-12l-3-30v76H43V96h-6v48H25V68l-3 30H10z"/></svg>';

/** "Ring 1", "Trinket 2", "Head": the name of a slot. */
export function slotName(lang: Lang, slot: SlotId): string {
  const name = t(lang, `slot.${slotTypeOf(SLOT_IDS.indexOf(slot))}` as MessageKey);
  const number = /[12]$/.exec(slot);
  return number ? `${name} ${number[0]}` : name;
}

interface SlotNode {
  button: HTMLButtonElement;
  temp: HTMLElement;
  level: HTMLElement;
  view: DollSlotView;
}

/**
 * The equipment doll: 16 slots around a figure and the stat totals under it. Used in the run (read only)
 * and in the menu's gear screen (a click on a slot takes the item off).
 */
export class Doll {
  private readonly nodes = new Map<SlotId, SlotNode>();
  private readonly title: HTMLElement;
  private readonly totals: Record<"str" | "agi" | "int" | "hp" | "armor", HTMLElement>;
  private readonly totalLabels: [HTMLElement, MessageKey][] = [];
  private readonly data: GameData;
  private readonly tooltip: ItemTooltip;
  private lang: Lang;

  constructor(root: HTMLElement, opts: {
    lang: Lang; heroName: string; data: GameData; tooltip: ItemTooltip; onSlotClick?: (slot: SlotId) => void;
  }) {
    this.lang = opts.lang;
    this.data = opts.data;
    this.tooltip = opts.tooltip;
    const doll = el("div", "doll", root);
    this.title = el("div", "doll-title", doll, opts.heroName);
    const body = el("div", "doll-body", doll);
    const left = el("div", "doll-column", body);
    const figure = el("div", "doll-figure", body);
    figure.innerHTML = FIGURE;
    const right = el("div", "doll-column wide", body);
    const bottom = el("div", "doll-bottom", doll);
    for (const [slots, parent] of [[LEFT, left], [RIGHT, right], [BOTTOM, bottom]] as const) {
      for (const slot of slots) this.nodes.set(slot, this.makeSlot(parent, slot, opts.onSlotClick));
    }
    const totals = el("div", "doll-totals", doll);
    const total = (key: "str" | "agi" | "int" | "hp" | "armor"): HTMLElement => {
      const cell = el("div", "doll-total", totals);
      this.totalLabels.push([el("span", "doll-total-label", cell), `gear.total.${key}` as MessageKey]);
      return el("span", "doll-total-value", cell);
    };
    this.totals = { str: total("str"), agi: total("agi"), int: total("int"), hp: total("hp"), armor: total("armor") };
    this.setLang(opts.lang);
  }

  setLang(lang: Lang): void {
    this.lang = lang;
    for (const [node, key] of this.totalLabels) setText(node, t(lang, key));
    for (const [slot, node] of this.nodes) node.button.setAttribute("aria-label", slotName(lang, slot));
  }

  setHeroName(name: string): void {
    setText(this.title, name);
  }

  private makeSlot(parent: HTMLElement, slot: SlotId, onClick?: (slot: SlotId) => void): SlotNode {
    const button = el("button", "doll-slot empty", parent);
    button.type = "button";
    button.dataset.slot = slot;
    button.innerHTML = iconSvg(slotTypeOf(SLOT_IDS.indexOf(slot)));
    const node: SlotNode = {
      button,
      temp: el("span", "slot-temp", button),
      level: el("span", "slot-level", button),
      view: { slot, item: null, level: 0, temp: 0 },
    };
    if (onClick) button.addEventListener("click", () => onClick(slot));
    else button.tabIndex = -1;
    const show = (): void => this.showTooltip(node);
    button.addEventListener("mouseenter", show);
    button.addEventListener("focus", show);
    button.addEventListener("mouseleave", () => this.tooltip.hide());
    button.addEventListener("blur", () => this.tooltip.hide());
    return node;
  }

  private showTooltip(node: SlotNode): void {
    const { view } = node;
    if (view.item) {
      this.tooltip.show(node.button, tooltipLines(this.lang, this.data, view.item, view.level, view.temp));
    } else {
      this.tooltip.show(node.button, {
        name: slotName(this.lang, view.slot), rarity: "common", sub: t(this.lang, "tooltip.empty"), lines: [], source: "",
      });
    }
  }

  /** Fills the slots and the totals. Slots that are not listed are shown empty. */
  render(slots: readonly DollSlotView[], totals: DollTotals): void {
    this.tooltip.hide();
    for (const node of this.nodes.values()) node.view = { slot: node.view.slot, item: null, level: 0, temp: 0 };
    for (const view of slots) {
      const node = this.nodes.get(view.slot);
      if (node) node.view = view;
    }
    for (const node of this.nodes.values()) {
      const { item, level, temp } = node.view;
      node.button.className = item ? `doll-slot rarity-${item.rarity}` : "doll-slot empty";
      setText(node.temp, temp > 0 ? `+${temp}` : "");
      setText(node.level, item && level > 1 ? String(level) : "");
    }
    const one = (value: number): string => String(Math.round(value * 10) / 10);
    setText(this.totals.str, String(Math.round(totals.str)));
    setText(this.totals.agi, String(Math.round(totals.agi)));
    setText(this.totals.int, String(Math.round(totals.int)));
    setText(this.totals.hp, String(Math.round(totals.maxHp)));
    setText(this.totals.armor, one(totals.armor));
  }
}
