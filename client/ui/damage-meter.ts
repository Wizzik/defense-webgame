import type { Run } from "../../sim";
import { meterLines, shortNumber } from "./damage-meter-lines";
import { el, setText } from "./dom";
import { type Lang, t } from "./i18n";

/** Steps between two redraws: the bars move four times a second, not every frame. */
const REDRAW_TICKS = 8;
const STORE_KEY = "dwg-damage-meter";

function storedVisible(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * The damage meter in a run (Petr, 2026-11-27; after the WoW addon Details): one bar per source of the local
 * player, the biggest first, with its damage, share and damage per second; hover a bar for hits, the top hit and
 * kills. N shows or hides it (remembered in this browser).
 */
export class DamageMeterPanel {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly sum: HTMLElement;
  private readonly list: HTMLElement;
  private visible = storedVisible();
  private lastTick = -1;
  private lastRun: Run | null = null;

  constructor(parent: HTMLElement) {
    this.root = el("div", "damage-meter", parent);
    this.root.id = "damage-meter";
    this.root.hidden = true;
    const head = el("div", "meter-head", this.root);
    this.title = el("span", "meter-title", head);
    this.sum = el("span", "meter-sum", head);
    this.list = el("div", "meter-rows", this.root);
  }

  get shown(): boolean {
    return this.visible;
  }

  toggle(): void {
    this.visible = !this.visible;
    try {
      localStorage.setItem(STORE_KEY, this.visible ? "1" : "0");
    } catch {
      // the choice lasts for this page only
    }
    this.lastTick = -1;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Redraws from the local player's meter (`run.current`) every REDRAW_TICKS steps. */
  update(run: Run, lang: Lang): void {
    // a level-up or chest offer covers the arena: the meter steps aside
    this.root.hidden = !this.visible || run.state === "levelUp" || run.state === "chest";
    if (this.root.hidden) return;
    if (run === this.lastRun && this.lastTick >= 0 && run.tick - this.lastTick < REDRAW_TICKS && run.tick >= this.lastTick) return;
    this.lastRun = run;
    this.lastTick = run.tick;
    const lines = meterLines(lang, run.players[run.current]!, run.tick);
    setText(this.title, t(lang, "meter.title"));
    setText(this.sum, `${shortNumber(lines.total)} · ${shortNumber(lines.dps)}/s`);
    const top = lines.rows[0]?.damage ?? 1;
    this.list.replaceChildren();
    if (lines.rows.length === 0) el("div", "meter-empty", this.list, t(lang, "meter.empty"));
    lines.rows.forEach((row, i) => {
      const bar = el("div", `meter-row meter-source-${row.source}`, this.list);
      bar.dataset.source = String(row.source);
      if (row.ability) bar.dataset.ability = row.ability;
      bar.title = t(lang, "meter.detail", {
        hits: row.hits, avg: shortNumber(row.damage / Math.max(1, row.hits)), top: shortNumber(row.top), kills: row.kills,
      });
      const fill = el("div", "meter-fill", bar);
      fill.style.width = `${(row.damage / top) * 100}%`;
      el("span", "meter-name", bar, `${i + 1}. ${row.name}`);
      el("span", "meter-value", bar, `${shortNumber(row.damage)} (${Math.round(row.share * 100)} %)`);
    });
  }
}
