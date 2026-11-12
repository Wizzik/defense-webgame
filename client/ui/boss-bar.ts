import type { Run } from "../../sim";
import { latestBoss } from "../game/boss";
import { el, setText } from "./dom";
import type { Lang } from "./i18n";

/** Name and hp of the living boss that came last; hidden when no boss lives. */
export class BossBar {
  private readonly root: HTMLElement;
  private readonly name: HTMLElement;
  private readonly fill: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el("div", "boss-bar", parent);
    this.root.id = "boss-bar";
    this.root.hidden = true;
    this.name = el("div", "boss-name", this.root);
    const track = el("div", "boss-track", this.root);
    this.fill = el("div", "boss-fill", track);
  }

  update(run: Run, lang: Lang): void {
    const slot = latestBoss(run);
    if (slot < 0) {
      if (!this.root.hidden) this.root.hidden = true;
      return;
    }
    const { enemies } = run;
    setText(this.name, run.data.enemies[enemies.type[slot]!]!.name[lang]);
    const share = Math.max(0, Math.min(1, enemies.hp[slot]! / enemies.maxHp[slot]!));
    this.fill.style.width = `${share * 100}%`;
    if (this.root.hidden) this.root.hidden = false;
  }
}
