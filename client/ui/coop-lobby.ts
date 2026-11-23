import { el, setText } from "./dom";
import { type Lang, t } from "./i18n";

export interface CoopLobbyHandlers {
  onHost(): void;
  onJoin(code: string): void;
  /** Host only, once a teammate is in: choose the course and start. */
  onStart(): void;
  onBack(): void;
}

/** What the lobby shows; `main` drives it from the link's state. */
export type LobbyState =
  | { kind: "idle" }
  | { kind: "opening" }
  | { kind: "waiting"; code: string; link: string }
  | { kind: "joining"; code: string }
  | { kind: "ready"; role: "host" | "guest"; mate: string }
  | { kind: "loading" }
  | { kind: "error"; message: string };

/**
 * The co-op lobby (multiplayer migration step 7): Host opens a room and shows its link to send; Join takes a room
 * code (or the link opens the lobby with it). Each player plays the hero chosen in the menu and wears his own gear;
 * the host chooses the course and starts. Two players for now.
 */
export class CoopLobby {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly hero: HTMLElement;
  private readonly host: HTMLButtonElement;
  private readonly joinLabel: HTMLElement;
  private readonly code: HTMLInputElement;
  private readonly join: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly link: HTMLInputElement;
  private readonly copy: HTMLButtonElement;
  private readonly start: HTMLButtonElement;
  private readonly back: HTMLButtonElement;
  private readonly note: HTMLElement;
  private lang: Lang = "en";
  private heroName = "";
  private state: LobbyState = { kind: "idle" };

  constructor(parent: HTMLElement, handlers: CoopLobbyHandlers) {
    this.root = el("div", "screen coop-lobby", parent);
    this.root.id = "coop-lobby";
    this.root.hidden = true;
    const panel = el("div", "panel coop-panel", this.root);
    this.title = el("h2", "coop-title", panel);
    this.hero = el("p", "coop-hero", panel);
    this.host = el("button", "button primary", panel);
    this.host.id = "coop-host";
    this.host.addEventListener("click", () => handlers.onHost());
    const joinRow = el("div", "coop-join", panel);
    this.joinLabel = el("span", "", joinRow);
    this.code = el("input", "coop-code", joinRow);
    this.code.id = "coop-code";
    this.code.maxLength = 10;
    this.code.spellcheck = false;
    this.code.placeholder = "dwg-abc234";
    this.join = el("button", "button", joinRow);
    this.join.id = "coop-join";
    this.join.addEventListener("click", () => handlers.onJoin(this.code.value.trim().toLowerCase()));
    this.code.addEventListener("keydown", (event) => {
      if (event.code === "Enter") handlers.onJoin(this.code.value.trim().toLowerCase());
    });
    this.status = el("p", "coop-status", panel);
    this.status.id = "coop-status";
    const linkRow = el("div", "coop-link", panel);
    this.link = el("input", "coop-link-text", linkRow);
    this.link.id = "coop-link";
    this.link.readOnly = true;
    this.copy = el("button", "button small", linkRow);
    this.copy.addEventListener("click", () => {
      this.link.select();
      void navigator.clipboard?.writeText(this.link.value).catch(() => {});
      setText(this.copy, t(this.lang, "coop.copied"));
    });
    this.start = el("button", "button primary", panel);
    this.start.id = "coop-start";
    this.start.addEventListener("click", () => handlers.onStart());
    this.note = el("p", "coop-note", panel);
    this.back = el("button", "button", panel);
    this.back.id = "coop-back";
    this.back.addEventListener("click", () => handlers.onBack());
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(lang: Lang, heroName: string, code = ""): void {
    this.lang = lang;
    this.heroName = heroName;
    if (code) this.code.value = code;
    this.root.hidden = false;
    this.render();
  }

  close(): void {
    this.root.hidden = true;
  }

  set(state: LobbyState): void {
    this.state = state;
    this.render();
  }

  private render(): void {
    const { lang, state } = this;
    setText(this.title, t(lang, "coop.title"));
    setText(this.hero, t(lang, "coop.hero", { name: this.heroName }));
    setText(this.host, t(lang, "coop.host"));
    setText(this.joinLabel, t(lang, "coop.code"));
    setText(this.join, t(lang, "coop.join"));
    setText(this.copy, t(lang, "coop.copy"));
    setText(this.start, t(lang, "coop.start"));
    setText(this.back, t(lang, "coop.back"));
    setText(this.note, t(lang, "coop.note"));
    const busy = state.kind !== "idle" && state.kind !== "error";
    this.host.disabled = busy;
    this.join.disabled = busy;
    this.code.disabled = busy;
    this.link.parentElement!.hidden = state.kind !== "waiting";
    if (state.kind === "waiting") this.link.value = state.link;
    this.start.hidden = !(state.kind === "ready" && state.role === "host");
    this.status.classList.toggle("error", state.kind === "error");
    let text = "";
    switch (state.kind) {
      case "opening": text = t(lang, "coop.opening"); break;
      case "waiting": text = t(lang, "coop.waiting", { code: state.code }); break;
      case "joining": text = t(lang, "coop.joining", { code: state.code }); break;
      case "ready":
        text = t(lang, state.role === "host" ? "coop.mateHost" : "coop.mateGuest", { name: state.mate });
        break;
      case "loading": text = t(lang, "menu.loading"); break;
      case "error": text = state.message; break;
    }
    setText(this.status, text);
  }
}
