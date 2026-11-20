import type { Settings } from "../settings/store";
import { el, setText } from "./dom";
import { type Lang, type MessageKey, t } from "./i18n";

type Volume = "master" | "music" | "sfx";
type Flag = "shake" | "numbers";

const VOLUMES: [Volume, MessageKey][] = [["master", "settings.master"], ["music", "settings.music"], ["sfx", "settings.sfx"]];
const FLAGS: [Flag, MessageKey][] = [["shake", "settings.shake"], ["numbers", "settings.numbers"]];

/** The settings: three volume sliders, two switches and Close; Escape closes it too. */
export class SettingsPanel {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly labels = new Map<Volume | Flag, HTMLElement>();
  private readonly sliders = new Map<Volume, HTMLInputElement>();
  private readonly values = new Map<Volume, HTMLElement>();
  private readonly toggles = new Map<Flag, HTMLInputElement>();
  private settings: Settings | null = null;

  constructor(parent: HTMLElement, private readonly handlers: { onChange(s: Settings): void; onClose(): void; onClick?(): void }) {
    this.root = el("div", "screen settings-panel", parent);
    this.root.id = "settings-panel";
    this.root.hidden = true;
    const frame = el("div", "gear-frame settings-frame", this.root);
    this.title = el("h2", "gear-title", frame);
    const rows = el("div", "settings-rows", frame);
    for (const [key] of VOLUMES) {
      const row = el("label", "settings-row", rows);
      this.labels.set(key, el("span", "settings-label", row));
      const slider = el("input", "settings-slider", row);
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.step = "1";
      slider.dataset.setting = key;
      slider.addEventListener("input", () => this.change({ [key]: Number(slider.value) / 100 }));
      this.sliders.set(key, slider);
      this.values.set(key, el("span", "settings-value", row));
    }
    for (const [key] of FLAGS) {
      const row = el("label", "settings-row", rows);
      this.labels.set(key, el("span", "settings-label", row));
      const box = el("input", "settings-toggle", row);
      box.type = "checkbox";
      box.dataset.setting = key;
      box.addEventListener("change", () => {
        this.handlers.onClick?.();
        this.change({ [key]: box.checked });
      });
      this.toggles.set(key, box);
    }
    this.closeButton = el("button", "button", frame);
    this.closeButton.id = "settings-close";
    this.closeButton.type = "button";
    this.closeButton.addEventListener("click", () => {
      this.handlers.onClick?.();
      this.handlers.onClose();
    });
    addEventListener("keydown", (event) => {
      if (event.code === "Escape" && this.isOpen) {
        event.stopImmediatePropagation();
        this.handlers.onClose();
      }
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(s: Settings, lang: Lang): void {
    this.settings = { ...s };
    setText(this.title, t(lang, "settings.title"));
    setText(this.closeButton, t(lang, "settings.close"));
    for (const [key, msg] of [...VOLUMES, ...FLAGS]) setText(this.labels.get(key)!, t(lang, msg));
    this.render();
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  private change(part: Partial<Settings>): void {
    if (!this.settings) return;
    this.settings = { ...this.settings, ...part };
    this.render();
    this.handlers.onChange({ ...this.settings });
  }

  private render(): void {
    const s = this.settings!;
    for (const [key] of VOLUMES) {
      const percent = Math.round(s[key] * 100);
      this.sliders.get(key)!.value = String(percent);
      setText(this.values.get(key)!, `${percent} %`);
    }
    for (const [key] of FLAGS) this.toggles.get(key)!.checked = s[key];
  }
}
