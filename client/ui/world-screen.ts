import { DIFFICULTY_IDS, type DifficultyId, type GameData } from "../../data/schema";
import { courseKey } from "../../meta";
import type { ProgressSession } from "../game/progress-session";
import { el } from "./dom";
import { type Lang, t } from "./i18n";
import { difficultyName, worldCard, worldDetail } from "./world-lines";

/**
 * The world and difficulty choice after the hero (spec 2026-11-21 4.4): a row of difficulties, the five world cards
 * in their colours, the lines of the chosen world under them, Back and Start. Locked choices are disabled.
 */
export class WorldScreen {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly difficultyLabel: HTMLElement;
  private readonly difficultyButtons = new Map<DifficultyId, HTMLButtonElement>();
  private readonly cards: HTMLButtonElement[] = [];
  private readonly detail: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly start: HTMLButtonElement;
  private readonly data: GameData;
  private readonly progress: ProgressSession;
  private readonly onStart: (world: number, difficulty: DifficultyId) => void;
  private readonly onBack: () => void;
  private world = 1;
  private difficulty: DifficultyId = "normal";
  private lang: Lang = "en";

  constructor(parent: HTMLElement, deps: {
    data: GameData;
    progress: ProgressSession;
    onStart(world: number, difficulty: DifficultyId): void;
    onBack(): void;
  }) {
    this.data = deps.data;
    this.progress = deps.progress;
    this.onStart = deps.onStart;
    this.onBack = deps.onBack;
    this.root = el("div", "screen world-screen", parent);
    this.root.id = "world-screen";
    this.root.hidden = true;
    const panel = el("div", "panel world-panel", this.root);
    this.title = el("h2", "world-title", panel);
    const row = el("div", "world-difficulties", panel);
    this.difficultyLabel = el("span", "world-difficulty-label", row);
    for (const id of DIFFICULTY_IDS) {
      const button = el("button", "button world-difficulty", row);
      button.dataset.difficulty = id;
      button.addEventListener("click", () => this.chooseDifficulty(id));
      this.difficultyButtons.set(id, button);
    }
    const cards = el("div", "world-cards", panel);
    this.data.worlds.forEach((world, i) => {
      const card = el("button", "button world-card", cards);
      card.dataset.world = String(i + 1);
      card.style.setProperty("--world-color", world.color);
      card.addEventListener("click", () => this.chooseWorld(i + 1));
      this.cards.push(card);
    });
    this.detail = el("div", "world-detail", panel);
    this.detail.id = "world-detail";
    const bottom = el("div", "world-bottom", panel);
    this.back = el("button", "button", bottom);
    this.back.id = "world-back";
    this.back.addEventListener("click", () => this.close());
    this.start = el("button", "button primary", bottom);
    this.start.id = "world-start";
    this.start.addEventListener("click", () => {
      if (!this.progress.isUnlocked(this.world, this.difficulty)) return;
      this.root.hidden = true;
      this.onStart(this.world, this.difficulty);
    });
    addEventListener("keydown", (event) => {
      if (event.code === "Escape" && this.isOpen) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Opens with a preselected course; a locked one falls back to the highest open world of the difficulty. */
  open(world: number, difficulty: DifficultyId, lang: Lang): void {
    this.lang = lang;
    this.difficulty = this.progress.isUnlocked(1, difficulty) ? difficulty : "normal";
    this.world = this.progress.isUnlocked(world, this.difficulty) ? world : this.highestOpen(this.difficulty);
    this.root.hidden = false;
    this.render();
    this.start.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.onBack();
  }

  private highestOpen(difficulty: DifficultyId): number {
    for (let w = this.data.worlds.length; w >= 1; w--) if (this.progress.isUnlocked(w, difficulty)) return w;
    return 1;
  }

  private chooseDifficulty(id: DifficultyId): void {
    if (!this.progress.isUnlocked(1, id)) return;
    this.difficulty = id;
    if (!this.progress.isUnlocked(this.world, id)) this.world = this.highestOpen(id);
    this.render();
  }

  private chooseWorld(world: number): void {
    if (!this.progress.isUnlocked(world, this.difficulty)) return;
    this.world = world;
    this.render();
  }

  private render(): void {
    const lang = this.lang;
    this.title.textContent = t(lang, "world.title");
    this.difficultyLabel.textContent = t(lang, "world.difficulty");
    for (const [id, button] of this.difficultyButtons) {
      const open = this.progress.isUnlocked(1, id);
      button.textContent = open ? difficultyName(id, lang) : `${difficultyName(id, lang)} 🔒`;
      button.disabled = !open;
      button.setAttribute("aria-pressed", String(id === this.difficulty));
    }
    this.cards.forEach((card, i) => {
      const world = i + 1;
      const lines = worldCard(
        this.data, world, this.progress.progress.best[courseKey(world, this.difficulty)],
        this.progress.isUnlocked(world, this.difficulty), lang,
      );
      card.replaceChildren();
      el("span", "world-card-name", card, lines.name);
      el("span", "world-card-status", card, lines.locked ? "🔒" : lines.status);
      if (lines.preparing) el("span", "world-card-tag", card, t(lang, "world.preparing"));
      card.disabled = lines.locked;
      card.title = lines.locked ? t(lang, "world.lockedHint") : "";
      card.setAttribute("aria-pressed", String(world === this.world));
    });
    this.detail.replaceChildren();
    const [blurb, ...rest] = worldDetail(this.data, this.world, this.difficulty, lang);
    el("p", "world-blurb", this.detail, blurb);
    for (const line of rest) el("p", "world-line", this.detail, line);
    this.back.textContent = t(lang, "world.back");
    this.start.textContent = t(lang, "world.start");
  }
}
