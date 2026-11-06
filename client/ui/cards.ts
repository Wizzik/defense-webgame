import type { Card, CardOffer, Run } from "../../sim";
import { cardLines } from "./card-lines";
import { el } from "./dom";
import { type Lang, type MessageKey, t } from "./i18n";

const ATTRIBUTE_KEYS: Record<"str" | "agi" | "int", MessageKey> = {
  str: "cards.str",
  agi: "cards.agi",
  int: "cards.int",
};

/** Real time after an offer appears during which picks are ignored. */
const PICK_DELAY_MS = 300;

/** Three upgrade cards side by side; a click or the keys 1 to 3 pick one. */
export class Cards {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly row: HTMLElement;
  private readonly hint: HTMLElement;
  private shown: CardOffer | null = null;
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
    const offer = run.state === "levelUp" ? run.offer : null;
    this.root.hidden = !offer;
    if (!offer || (offer === this.shown && lang === this.shownLang)) return;
    if (offer !== this.shown) this.acceptAt = performance.now() + PICK_DELAY_MS;
    this.shown = offer;
    this.shownLang = lang;
    this.title.textContent = t(lang, "cards.title");
    this.hint.textContent = t(lang, "cards.keys");
    this.row.replaceChildren();
    offer.cards.forEach((card, i) => this.row.appendChild(this.render(run, card, i, lang)));
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
    const name =
      card.kind === "ability"
        ? t(lang, "cards.ability", { name: run.abilities[card.slot].def.name[lang], n: card.toLevel })
        : t(lang, ATTRIBUTE_KEYS[card.attribute], { n: card.amount });
    el("span", "card-name", button, name);
    for (const line of cardLines(run, card)) {
      const row = el("span", "card-line", button);
      el("span", "card-stat", row, t(lang, line.label));
      el("span", "card-change", row, `${line.from} → ${line.to}`);
    }
    button.addEventListener("click", () => this.pick(index));
    return button;
  }
}
