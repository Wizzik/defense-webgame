import { el } from "./dom";
import { type Lang, t } from "./i18n";

const LANGS: Lang[] = ["en", "cs"];

/** Title screen: start button, hero name, controls and the language switch. */
export class Menu {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly hero: HTMLElement;
  private readonly start: HTMLButtonElement;
  private readonly controls: HTMLElement;
  private readonly languageLabel: HTMLElement;
  private readonly langButtons = new Map<Lang, HTMLButtonElement>();

  constructor(parent: HTMLElement, handlers: { onStart(): void; onLang(lang: Lang): void }) {
    this.root = el("div", "screen menu", parent);
    this.root.id = "menu";
    const panel = el("div", "panel", this.root);
    this.title = el("h1", "menu-title", panel);
    this.subtitle = el("p", "menu-subtitle", panel);
    this.hero = el("p", "menu-hero", panel);
    this.start = el("button", "button primary", panel);
    this.start.id = "start";
    this.start.addEventListener("click", handlers.onStart);
    this.controls = el("p", "menu-controls", panel);
    const row = el("div", "menu-lang", panel);
    this.languageLabel = el("span", "", row);
    for (const lang of LANGS) {
      const button = el("button", "button small", row, lang.toUpperCase());
      button.addEventListener("click", () => handlers.onLang(lang));
      this.langButtons.set(lang, button);
    }
  }

  setLang(lang: Lang, heroName: string): void {
    this.title.textContent = t(lang, "menu.title");
    this.subtitle.textContent = t(lang, "menu.subtitle");
    this.hero.textContent = t(lang, "menu.hero", { name: heroName });
    this.start.textContent = t(lang, "menu.start");
    this.controls.textContent = t(lang, "menu.controls");
    this.languageLabel.textContent = t(lang, "menu.language");
    for (const [code, button] of this.langButtons) button.setAttribute("aria-pressed", String(code === lang));
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    if (visible) this.start.focus();
  }
}
