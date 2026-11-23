import { type PerspectiveCamera, Vector3 } from "three/webgpu";
import { reviveShare, type Run } from "../../sim";
import { SCENE_SCALE } from "../render/coords";
import { el, setText } from "./dom";
import { type Lang, t } from "./i18n";

/** The plate floats this high over a teammate's feet (scene units). */
const PLATE_HEIGHT = 2.6;

interface Row {
  root: HTMLElement;
  name: HTMLElement;
  hp: HTMLElement;
  state: HTMLElement;
  reviveBar: HTMLElement;
  revive: HTMLElement;
  plate: HTMLElement;
  plateHp: HTMLElement;
  plateRevive: HTMLElement;
}

/**
 * Co-op HUD of the teammates (multiplayer migration step 7): in the left column under the own bars each teammate's
 * hero with his hp, "down" with the revive progress or "choosing"; over each teammate's hero a small plate with his
 * hp bar, or a cross and the revive ring when he is down. A banner tells the local player when he is down himself
 * and when the teammate left. Hidden in a run of one player. `update` reads `run.current` as the local player.
 */
export class TeamPanel {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly plates: HTMLElement;
  private readonly rows: Row[] = [];
  private readonly point = new Vector3();
  private note = "";

  constructor(parent: HTMLElement, private readonly camera: PerspectiveCamera) {
    this.root = el("div", "team", parent);
    this.root.id = "team";
    this.root.hidden = true;
    this.list = el("div", "team-list", this.root);
    this.banner = el("p", "team-banner", this.root);
    this.banner.id = "team-banner";
    this.banner.hidden = true;
    this.plates = el("div", "team-plates", parent);
  }

  /** A line for the banner (the teammate left, the link broke); "" clears it. */
  setNote(text: string): void {
    this.note = text;
  }

  hide(): void {
    this.root.hidden = true;
    for (const row of this.rows) row.plate.hidden = true;
  }

  update(run: Run, lang: Lang, width: number, height: number): void {
    const local = run.current;
    if (run.players.length < 2 || (run.state !== "playing" && run.state !== "levelUp" && run.state !== "chest")) {
      this.hide();
      return;
    }
    this.root.hidden = false;
    let r = 0;
    this.camera.updateMatrixWorld();
    for (let p = 0; p < run.players.length; p++) {
      if (p === local) continue;
      const row = this.row(r++);
      const { hero } = run.players[p]!;
      const down = hero.hp <= 0;
      const share = reviveShare(run, p);
      const hpShare = Math.max(0, hero.hp / hero.stats.maxHp);
      row.root.hidden = false;
      row.root.classList.toggle("down", down);
      setText(row.name, hero.def.name[lang]);
      row.hp.style.width = `${(hpShare * 100).toFixed(1)}%`;
      const state = down ? t(lang, "team.down") : run.players[p]!.choosingTicks > 0 ? t(lang, "team.choosing") : "";
      setText(row.state, state);
      row.reviveBar.hidden = !down;
      row.revive.style.width = `${(share * 100).toFixed(1)}%`;
      this.place(row, hero.x, hero.y, width, height, down, hpShare, share);
    }
    for (let i = r; i < this.rows.length; i++) {
      this.rows[i]!.root.hidden = true;
      this.rows[i]!.plate.hidden = true;
    }
    const own = run.players[local]!.hero;
    const text = own.hp <= 0 ? t(lang, "team.youDown", { n: Math.round(reviveShare(run, local) * 100) }) : this.note;
    this.banner.hidden = text === "";
    setText(this.banner, text);
  }

  /** The plate over the teammate's hero, hidden when he is off screen. */
  private place(row: Row, x: number, y: number, width: number, height: number, down: boolean, hp: number, revive: number): void {
    this.point.set(x * SCENE_SCALE, PLATE_HEIGHT, -y * SCENE_SCALE).project(this.camera);
    const shown = this.point.z <= 1 && Math.abs(this.point.x) <= 1.05 && Math.abs(this.point.y) <= 1.05;
    row.plate.hidden = !shown;
    if (!shown) return;
    row.plate.classList.toggle("down", down);
    row.plateHp.style.width = `${(hp * 100).toFixed(1)}%`;
    row.plateRevive.style.setProperty("--share", revive.toFixed(3));
    const px = (this.point.x * 0.5 + 0.5) * width;
    const py = (-this.point.y * 0.5 + 0.5) * height;
    row.plate.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
  }

  private row(i: number): Row {
    let row = this.rows[i];
    if (row) return row;
    const root = el("div", "team-row", this.list);
    const name = el("span", "team-name", root);
    const state = el("span", "team-state", root);
    const bar = el("div", "bar hp team-bar", root);
    const hp = el("div", "bar-fill", bar);
    const reviveBar = el("div", "bar revive team-bar", root);
    const revive = el("div", "bar-fill", reviveBar);
    const plate = el("div", "team-plate", this.plates);
    const plateBar = el("div", "team-plate-bar", plate);
    const plateHp = el("div", "team-plate-fill", plateBar);
    const plateRevive = el("div", "team-plate-revive", plate);
    el("span", "team-plate-cross", plate, "✝");
    row = { root, name, hp, state, reviveBar, revive, plate, plateHp, plateRevive };
    this.rows.push(row);
    return row;
  }
}
