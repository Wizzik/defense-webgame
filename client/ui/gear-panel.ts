import type { GameData } from "../../data/schema";
import { type Run, SLOT_IDS } from "../../sim";
import type { Session } from "../game/session";
import { Doll, type DollSlotView } from "./doll";
import { el, setText } from "./dom";
import { type Lang, t } from "./i18n";
import { ItemTooltip } from "./item-tooltip";

/** The doll slots of a run: what the hero wears now, with the levels chests added. */
export function runSlots(run: Run): DollSlotView[] {
  const { gear, data } = run;
  const slots: DollSlotView[] = [];
  for (let i = 0; i < SLOT_IDS.length; i++) {
    const index = gear.item[i]!;
    if (index < 0) continue;
    slots.push({ slot: SLOT_IDS[i]!, item: data.items[index]!, level: gear.base[i]!, temp: gear.temp[i]! });
  }
  return slots;
}

/**
 * The gear panel of a run: the doll, read only. C opens it while the run is played and pauses the run;
 * C or Escape closes it. It does not open over the menu, the cards or the end screen.
 */
export class GearPanel {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly doll: Doll;
  private readonly session: Session;
  private readonly getLang: () => Lang;
  private readonly menuOpen: () => boolean;

  constructor(parent: HTMLElement, deps: { data: GameData; session: Session; getLang: () => Lang; menuOpen: () => boolean }) {
    this.session = deps.session;
    this.getLang = deps.getLang;
    this.menuOpen = deps.menuOpen;
    this.root = el("div", "screen gear-panel", parent);
    this.root.id = "gear-panel";
    this.root.hidden = true;
    const panel = el("div", "gear-frame", this.root);
    this.title = el("h2", "gear-title", panel);
    const tooltip = new ItemTooltip(this.root);
    this.doll = new Doll(panel, { lang: deps.getLang(), heroName: "", data: deps.data, tooltip });
    this.hint = el("p", "cards-hint", panel);
    addEventListener("keydown", (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "KeyC") this.toggle();
      else if (event.code === "Escape" && this.open) this.close();
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  toggle(): void {
    if (this.open) {
      this.close();
      return;
    }
    const run = this.session.run;
    if (!run || run.state !== "playing" || this.session.paused || this.menuOpen()) return;
    const lang = this.getLang();
    const { hero } = run;
    setText(this.title, t(lang, "gear.title"));
    setText(this.hint, t(lang, "gear.close"));
    this.doll.setLang(lang);
    this.doll.setHeroName(hero.def.name[lang]);
    this.doll.render(runSlots(run), {
      ...hero.stats, str: hero.str + hero.gear.str, agi: hero.agi + hero.gear.agi, int: hero.int + hero.gear.int,
    });
    this.session.paused = true;
    this.root.hidden = false;
  }

  close(): void {
    if (!this.open) return;
    this.root.hidden = true;
    this.session.paused = false;
  }
}
