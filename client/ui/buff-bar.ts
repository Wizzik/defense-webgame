import { type BuffState, TICKS_PER_SECOND } from "../../sim";
import { el, setText } from "./dom";
import { type Lang, t } from "./i18n";

export type BuffKind = "boots" | "berserk" | "heal" | "web" | "root";

/** The hero's snares the bar reads (sim HeroState). */
export interface Snares {
  slowTicks: number;
  rootTicks: number;
}

export interface BuffCell {
  kind: BuffKind;
  /** Whole seconds left, rounded up. */
  seconds: number;
  label: string;
}

const KINDS: readonly BuffKind[] = ["boots", "berserk", "heal", "web", "root"];

function ticksOf(buffs: BuffState, snares: Snares, kind: BuffKind): number {
  switch (kind) {
    case "boots": return buffs.bootsTicks;
    case "berserk": return buffs.berserkTicks;
    case "heal": return buffs.healTicks;
    case "web": return snares.slowTicks;
    case "root": return snares.rootTicks;
  }
}

function labelOf(kind: BuffKind, lang: Lang): string {
  return kind === "web" || kind === "root" ? t(lang, `snare.${kind}`) : t(lang, `orb.${kind}`);
}

/** The running orb effects and snares, in the order boots, berserk, heal, web, roots. */
export function buffCells(buffs: BuffState, snares: Snares, lang: Lang): BuffCell[] {
  const out: BuffCell[] = [];
  for (const kind of KINDS) {
    const ticks = ticksOf(buffs, snares, kind);
    if (ticks > 0) out.push({ kind, seconds: Math.ceil(ticks / TICKS_PER_SECOND), label: labelOf(kind, lang) });
  }
  return out;
}

/** Our own glyphs (24 x 24, drawn with the text colour): a boot, an axe, a cross, a web, roots. */
export const ORB_GLYPHS: Record<BuffKind, string> = {
  boots: '<path d="M8 3h6v10l6 3v4H5v-4l3-3z"/><path d="M2 10h4M1 14h3"/>',
  berserk: '<path d="M7 21L17 5"/><path d="M14 3c4 0 7 3 7 7-3 0-6-1-8-3z"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  web: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/><path d="M12 7l5 5-5 5-5-5z"/>',
  root: '<path d="M12 3v9"/><path d="M12 12c-2 3-5 4-8 5M12 12c2 3 5 4 8 5M12 12v9M8 15c0 3-1 5-3 6M16 15c0 3 1 5 3 6"/>',
};

function glyph(kind: BuffKind): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ORB_GLYPHS[kind]}</svg>`;
}

interface Node {
  root: HTMLElement;
  seconds: HTMLElement;
}

/** The running orb effects and snares over the ability bar: a glyph with its seconds left each, hidden when none runs. */
export class BuffBar {
  private readonly root: HTMLElement;
  private readonly nodes = new Map<BuffKind, Node>();

  constructor(parent: HTMLElement) {
    this.root = el("div", "hud-buffs", parent);
    for (const kind of KINDS) {
      const root = el("div", `buff-cell ${kind}`, this.root);
      root.dataset.kind = kind;
      root.hidden = true;
      el("span", "buff-icon", root).innerHTML = glyph(kind);
      const seconds = el("span", "buff-seconds", root);
      this.nodes.set(kind, { root, seconds });
    }
  }

  update(buffs: BuffState, snares: Snares, lang: Lang): void {
    for (const kind of KINDS) {
      const node = this.nodes.get(kind)!;
      const ticks = ticksOf(buffs, snares, kind);
      node.root.hidden = ticks <= 0;
      if (ticks <= 0) continue;
      setText(node.seconds, `${Math.ceil(ticks / TICKS_PER_SECOND)} s`);
      const title = labelOf(kind, lang);
      if (node.root.title !== title) node.root.title = title;
    }
  }
}
