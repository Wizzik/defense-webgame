import type { Hero } from "../../data/schema";
import { el } from "./dom";
import { type Lang, type MessageKey, t } from "./i18n";

const LANGS: Lang[] = ["en", "cs"];
const ATTRIBUTE_KEYS: Record<Hero["primary"], MessageKey> = { str: "attr.str", agi: "attr.agi", int: "attr.int" };

/** Title screen: hero choice with role and main attribute, start button, controls and the language switch. */
export class Menu {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly heroTitle: HTMLElement;
  private readonly heroRole: HTMLElement;
  private readonly heroPrimary: HTMLElement;
  private readonly heroButtons = new Map<string, HTMLButtonElement>();
  private readonly heroes: readonly Hero[];
  private heroId: string;
  private readonly start: HTMLButtonElement;
  private readonly controls: HTMLElement;
  private readonly languageLabel: HTMLElement;
  private readonly sound: HTMLButtonElement;
  private readonly gpuWarning: HTMLElement;
  private readonly saveWarning: HTMLElement;
  private soundOn = true;
  private loading = false;
  private failed = false;
  private lang: Lang = "en";
  private readonly langButtons = new Map<Lang, HTMLButtonElement>();

  constructor(
    parent: HTMLElement,
    heroes: readonly Hero[],
    heroId: string,
    handlers: { onStart(): void; onLang(lang: Lang): void; onSound(): void; onHero(id: string): void },
  ) {
    this.heroes = heroes;
    this.heroId = heroId;
    this.root = el("div", "screen menu", parent);
    this.root.id = "menu";
    const panel = el("div", "panel", this.root);
    this.title = el("h1", "menu-title", panel);
    this.subtitle = el("p", "menu-subtitle", panel);
    this.heroTitle = el("p", "menu-hero-title", panel);
    const row = el("div", "menu-heroes", panel);
    for (const hero of heroes) {
      const button = el("button", "button hero-button", row);
      button.dataset.hero = hero.id;
      button.addEventListener("click", () => handlers.onHero(hero.id));
      this.heroButtons.set(hero.id, button);
    }
    this.heroRole = el("p", "menu-hero-role", panel);
    this.heroPrimary = el("p", "menu-hero-primary", panel);
    this.gpuWarning = el("p", "menu-warning", panel);
    this.gpuWarning.id = "gpu-warning";
    this.gpuWarning.hidden = true;
    this.saveWarning = el("p", "menu-warning", panel);
    this.saveWarning.id = "save-warning";
    this.saveWarning.hidden = true;
    this.start = el("button", "button primary", panel);
    this.start.id = "start";
    this.start.addEventListener("click", handlers.onStart);
    this.controls = el("p", "menu-controls", panel);
    this.sound = el("button", "button small", panel);
    this.sound.addEventListener("click", handlers.onSound);
    const langRow = el("div", "menu-lang", panel);
    this.languageLabel = el("span", "", langRow);
    for (const lang of LANGS) {
      const button = el("button", "button small", langRow, lang.toUpperCase());
      button.addEventListener("click", () => handlers.onLang(lang));
      this.langButtons.set(lang, button);
    }
  }

  setLang(lang: Lang): void {
    this.title.textContent = t(lang, "menu.title");
    this.subtitle.textContent = t(lang, "menu.subtitle");
    this.heroTitle.textContent = t(lang, "menu.chooseHero");
    this.lang = lang;
    this.renderStart();
    this.controls.textContent = t(lang, "menu.controls");
    this.languageLabel.textContent = t(lang, "menu.language");
    this.gpuWarning.textContent = t(lang, "menu.gpuWarning");
    this.saveWarning.textContent = t(lang, "menu.noSave");
    this.renderHero();
    this.renderSound();
    for (const [code, button] of this.langButtons) button.setAttribute("aria-pressed", String(code === lang));
  }

  /** Marks the chosen hero and shows its role and main attribute. */
  setHero(id: string): void {
    this.heroId = id;
    this.renderHero();
  }

  private renderHero(): void {
    const lang = this.lang;
    for (const hero of this.heroes) {
      const button = this.heroButtons.get(hero.id)!;
      button.textContent = hero.name[lang];
      button.setAttribute("aria-pressed", String(hero.id === this.heroId));
    }
    const chosen = this.heroes.find((h) => h.id === this.heroId);
    if (!chosen) return;
    this.heroRole.textContent = chosen.role[lang];
    this.heroPrimary.textContent = t(lang, "menu.primary", { attr: t(lang, ATTRIBUTE_KEYS[chosen.primary]) });
  }

  /**
   * While the hero's model loads, Start is disabled and says so. A `failed` load keeps Start disabled
   * (the run would have no hero) but shows the normal label; the error itself is shown elsewhere.
   */
  setLoading(loading: boolean, failed = false): void {
    this.loading = loading;
    this.failed = failed;
    this.renderStart();
    if (!this.start.disabled && !this.root.hidden) this.start.focus();
  }

  private renderStart(): void {
    this.start.textContent = t(this.lang, this.loading ? "menu.loading" : "menu.start");
    this.start.disabled = this.loading || this.failed;
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    this.renderSound();
  }

  private renderSound(): void {
    this.sound.textContent = t(this.lang, this.soundOn ? "menu.soundOn" : "menu.soundOff");
    this.sound.setAttribute("aria-pressed", String(this.soundOn));
  }

  /** Shows the warning that the browser draws without the graphics card. */
  setGpuWarning(software: boolean): void {
    this.gpuWarning.hidden = !software;
  }

  /** Shows the sentence that this window does not store the gear. */
  setSaveWarning(shown: boolean): void {
    this.saveWarning.hidden = !shown;
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) this.start.focus();
  }
}
