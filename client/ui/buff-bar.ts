import { type BuffState, TICKS_PER_SECOND } from "../../sim";
import { el, setText } from "./dom";
import { type Lang, t } from "./i18n";

export type BuffKind = "boots" | "berserk" | "heal";

export interface BuffCell {
  kind: BuffKind;
  /** Whole seconds left, rounded up. */
  seconds: number;
  label: string;
}

const KINDS: readonly BuffKind[] = ["boots", "berserk", "heal"];

function ticksOf(buffs: BuffState, kind: BuffKind): number {
  return kind === "boots" ? buffs.bootsTicks : kind === "berserk" ? buffs.berserkTicks : buffs.healTicks;
}

/** The running orb effects, in the order boots, berserk, heal. */
export function buffCells(buffs: BuffState, lang: Lang): BuffCell[] {
  const out: BuffCell[] = [];
  for (const kind of KINDS) {
    const ticks = ticksOf(buffs, kind);
    if (ticks > 0) out.push({ kind, seconds: Math.ceil(ticks / TICKS_PER_SECOND), label: t(lang, `orb.${kind}`) });
  }
  return out;
}

/** Our own glyphs of the three orbs (24 x 24, drawn with the text colour): a boot, an axe, a cross. */
export const ORB_GLYPHS: Record<BuffKind, string> = {
  boots: '<path d="M8 3h6v10l6 3v4H5v-4l3-3z"/><path d="M2 10h4M1 14h3"/>',
  berserk: '<path d="M7 21L17 5"/><path d="M14 3c4 0 7 3 7 7-3 0-6-1-8-3z"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
};

function glyph(kind: BuffKind): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ORB_GLYPHS[kind]}</svg>`;
}

interface Node {
  root: HTMLElement;
  seconds: HTMLElement;
}

/** The running orb effects over the ability bar: a glyph with its seconds left per effect, hidden when none runs. */
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

  update(buffs: BuffState, lang: Lang): void {
    for (const kind of KINDS) {
      const node = this.nodes.get(kind)!;
      const ticks = ticksOf(buffs, kind);
      node.root.hidden = ticks <= 0;
      if (ticks <= 0) continue;
      setText(node.seconds, `${Math.ceil(ticks / TICKS_PER_SECOND)} s`);
      const title = t(lang, `orb.${kind}`);
      if (node.root.title !== title) node.root.title = title;
    }
  }
}
