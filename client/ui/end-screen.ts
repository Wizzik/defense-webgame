import type { Drop } from "../../meta";
import type { Run } from "../../sim";
import { meterLines, shortNumber } from "./damage-meter-lines";
import { el, formatTime } from "./dom";
import { dropLine } from "./drop-lines";
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
  private readonly gear: HTMLButtonElement;

  /** `onGear`: co-op only, the gear screen before the group's next run (the end screen comes back with `reveal`). */
  constructor(parent: HTMLElement, onAgain: () => void, onGear: () => void = () => {}) {
    this.root = el("div", "screen end", parent);
    this.root.id = "end";
    this.root.hidden = true;
    const panel = el("div", "panel", this.root);
    this.title = el("h2", "end-title", panel);
    this.stats = el("div", "end-stats", panel);
    this.again = el("button", "button primary", panel);
    this.again.id = "again";
    this.again.addEventListener("click", onAgain);
    this.gear = el("button", "button", panel);
    this.gear.id = "end-gear";
    this.gear.hidden = true;
    this.gear.addEventListener("click", onGear);
  }

  /**
   * `drops`: what the bosses of the run dropped; the items are kept whatever the result is. `coop`: "host" when
   * Again starts the same group's next run, "guest" when this window waits for the host (the button leaves).
   */
  show(run: Run, seed: number, lang: Lang, drops: readonly Drop[] = [], coop: "host" | "guest" | null = null): void {
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
    const loot = drops.filter((drop) => drop.kind !== "none");
    if (loot.length > 0) {
      el("p", "end-line end-drops-title", this.stats, t(lang, "end.drops"));
      for (const drop of loot) {
        const line = dropLine(lang, drop);
        el("p", `end-line end-drop ${line.tone}`, this.stats, line.text.replace(/^[^:]+:\s*/, ""));
      }
    }
    // the damage meter of the run, the five biggest sources
    const meter = meterLines(lang, run.players[run.current]!, run.tick);
    if (meter.rows.length > 0) {
      el("p", "end-line end-drops-title", this.stats, t(lang, "end.damage", { total: shortNumber(meter.total), dps: shortNumber(meter.dps) }));
      for (const row of meter.rows.slice(0, 5)) {
        el("p", "end-line end-meter", this.stats, `${row.name}: ${shortNumber(row.damage)} (${Math.round(row.share * 100)} %)`);
      }
    }
    if (coop === "guest") el("p", "end-line end-wait", this.stats, t(lang, "end.waitHost"));
    this.root.dataset.coop = coop ?? "";
    this.again.textContent = t(lang, coop === "guest" ? "end.leave" : coop === "host" ? "end.againGroup" : "end.again");
    // co-op: change the gear (wear what the run dropped) before the host starts the group's next run
    this.gear.hidden = coop === null;
    this.gear.textContent = t(lang, "end.gear");
    this.root.hidden = false;
    this.again.focus();
  }

  /** Shows the end screen again as it was (back from the gear screen). */
  reveal(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
