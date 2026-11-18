import { ULTIMATE_SLOT } from "../../sim";
import type { Card, CardOffer, ChestCard, ChestOffer, Run } from "../../sim";
import { cardLines } from "./card-lines";
import { chestLines } from "./chest-lines";
import { el } from "./dom";
import { abilityIconSvg } from "./ability-icons";
import { iconSvg } from "./item-icons";
import { type Lang, type MessageKey, t } from "./i18n";

const ATTRIBUTE_KEYS: Record<"str" | "agi" | "int", MessageKey> = {
  str: "cards.str",
  agi: "cards.agi",
  int: "cards.int",
};

/** Real time after an offer appears during which picks are ignored. */
const PICK_DELAY_MS = 300;

/** Three cards side by side, for a level-up or for an opened chest; a click or the keys 1 to 3 pick one. */
export class Cards {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly row: HTMLElement;
  private readonly hint: HTMLElement;
  private shown: CardOffer | ChestOffer | null = null;
  private shownLang: Lang | null = null;
  private readonly onPick: (index: number) => void;
  /** Picks before this real time (ms) are ignored: the player has not seen the offer yet. */
  private acceptAt = 0;

  constructor(parent: HTMLElement, onPick: (index: number) => void) {
    this.onPick = onPick;
    this.root = el("div", "screen cards", parent);
    this.root.id = "cards";
    this.root.hidden = true;
    this.title = el("h2", "cards-title", this.root);
    this.row = el("div", "cards-row", this.root);
    this.hint = el("p", "cards-hint", this.root);
    addEventListener("keydown", (event) => {
      if (this.root.hidden || event.repeat) return;
      const match = /^(?:Digit|Numpad)([123])$/.exec(event.code);
      if (match) this.pick(Number(match[1]) - 1);
    });
  }

  /** Shows the offer of the run, or hides the cards when there is none. */
  update(run: Run, lang: Lang): void {
    const chest = run.state === "chest" ? run.chestOffer : null;
    const offer = run.state === "levelUp" ? run.offer : chest;
    this.root.hidden = !offer;
    if (!offer || (offer === this.shown && lang === this.shownLang)) return;
    if (offer !== this.shown) this.acceptAt = performance.now() + PICK_DELAY_MS;
    this.shown = offer;
    this.shownLang = lang;
    this.title.textContent = t(lang, chest ? "chest.title" : "cards.title");
    this.hint.textContent = t(lang, "cards.keys");
    this.row.replaceChildren();
    if (chest) chest.cards.forEach((card, i) => this.row.appendChild(this.renderChest(run, card, i, lang)));
    else if (run.offer) run.offer.cards.forEach((card, i) => this.row.appendChild(this.render(run, card, i, lang)));
  }

  /** A chest card: the slot's glyph, the item in its rarity colour, the rarity, what the pick does and the stat rows. */
  private renderChest(run: Run, card: ChestCard, index: number, lang: Lang): HTMLElement {
    const info = chestLines(lang, run.data, run.gear, card);
    const button = el("button", `card chest rarity-${info.rarity}`);
    el("span", "card-key", button, String(index + 1));
    el("span", "card-badge", button, info.slot);
    const head = el("span", "chest-head", button);
    const glyph = el("span", "chest-glyph", head);
    glyph.innerHTML = iconSvg(info.slotType);
    el("span", "card-name", head, info.title);
    el("span", "chest-rarity", button, info.rarityName);
    el("span", "card-desc", button, info.action);
    for (const line of info.lines) el("span", `card-line item-line tooltip-line ${line.tone}`, button, line.text);
    button.addEventListener("click", () => this.pick(index));
    return button;
  }

  private pick(index: number): void {
    if (performance.now() < this.acceptAt) return;
    this.onPick(index);
  }

  hide(): void {
    this.root.hidden = true;
  }

  private render(run: Run, card: Card, index: number, lang: Lang): HTMLElement {
    const button = el("button", `card ${card.kind}`);
    el("span", "card-key", button, String(index + 1));
    let name: string;
    if (card.kind === "ability") {
      const { def } = run.abilities[card.slot];
      const learn = card.fromLevel === 0;
      name = learn
        ? t(lang, "cards.learn", { name: def.name[lang] })
        : t(lang, "cards.ability", { name: def.name[lang], n: card.toLevel });
      if (card.slot === ULTIMATE_SLOT) el("span", "card-badge", button, t(lang, "cards.ultimate"));
      el("span", "card-name", button, name);
      if (learn) el("span", "card-desc", button, def.description[lang]);
    } else if (card.kind === "learn") {
      const def = run.data.abilities[card.ability];
      const badge = el("span", "card-badge card-new", button);
      badge.innerHTML = abilityIconSvg(def.id);
      el("span", "", badge, t(lang, "cards.new"));
      name = def.name[lang];
      el("span", "card-name", button, name);
      el("span", "card-desc", button, def.description[lang]);
    } else {
      name = t(lang, ATTRIBUTE_KEYS[card.attribute], { n: card.amount });
      el("span", "card-name", button, name);
    }
    for (const line of cardLines(run, card)) {
      const row = el("span", "card-line", button);
      el("span", "card-stat", row, t(lang, line.label));
      el("span", "card-change", row, line.from === "" ? line.to : `${line.from} → ${line.to}`);
    }
    button.addEventListener("click", () => this.pick(index));
    return button;
  }
}
