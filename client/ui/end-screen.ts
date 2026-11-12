import type { Run } from "../../sim";
import { el, formatTime } from "./dom";
import { type Lang, type MessageKey, t } from "./i18n";

const RESULT_KEYS: Record<NonNullable<Run["result"]>, MessageKey> = {
  won: "end.won",
  castle: "end.lostCastle",
  hero: "end.lostHero",
};

/** Result of a finished run with a button back to the menu. */
export class EndScreen {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly again: HTMLButtonElement;

  constructor(parent: HTMLElement, onAgain: () => void) {
    this.root = el("div", "screen end", parent);
    this.root.id = "end";
    this.root.hidden = true;
    const panel = el("div", "panel", this.root);
    this.title = el("h2", "end-title", panel);
    this.stats = el("div", "end-stats", panel);
    this.again = el("button", "button primary", panel);
    this.again.id = "again";
    this.again.addEventListener("click", onAgain);
  }

  show(run: Run, seed: number, lang: Lang): void {
    const result = run.result ?? "castle";
    this.root.dataset.result = result;
    this.title.textContent = t(lang, RESULT_KEYS[result]);
    this.stats.replaceChildren();
    const lines = [
      // a win ends in the step the final boss falls
      t(lang, result === "won" ? "end.bossTime" : "end.time", { time: formatTime(run.timeSeconds) }),
      t(lang, "end.kills", { n: run.stats.kills }),
      t(lang, "end.level", { n: run.hero.level }),
      t(lang, "end.seed", { seed }),
    ];
    for (const line of lines) el("p", "end-line", this.stats, line);
    this.again.textContent = t(lang, "end.again");
    this.root.hidden = false;
    this.again.focus();
  }

  hide(): void {
    this.root.hidden = true;
  }
}
