import { type BuffState, TICKS_PER_SECOND } from "../../sim";
import { el, setText } from "./dom";
import { type Lang, t } from "./i18n";

export type BuffKind =
  | "boots" | "berserk" | "heal" | "web" | "root" | "storm" | "sand" | "thicket" | "snow" | "chill" | "meteor" | "fire";

/** The world's natural event as the bar shows it: steps until the nearest bolt (or meteor in world 5), steps of the
 *  running sandstorm or blizzard, whether the hero stands in a thicket or a pool of fire, and whether he is chilled. */
export interface HazardCells {
  stormTicks: number;
  sandTicks: number;
  inThicket: boolean;
  snowTicks: number;
  chilled: boolean;
  meteorTicks: number;
  inFire: boolean;
}

const NO_HAZARD: HazardCells = {
  stormTicks: 0, sandTicks: 0, inThicket: false, snowTicks: 0, chilled: false, meteorTicks: 0, inFire: false,
};
/** Kinds shown without seconds, while their state holds. */
const NO_SECONDS = new Set<BuffKind>(["thicket", "chill", "fire"]);

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

const KINDS: readonly BuffKind[] = [
  "boots", "berserk", "heal", "web", "root", "storm", "meteor", "sand", "snow", "chill", "thicket", "fire",
];

function ticksOf(buffs: BuffState, snares: Snares, kind: BuffKind, hazard: HazardCells): number {
  switch (kind) {
    case "storm": return hazard.stormTicks;
    case "sand": return hazard.sandTicks;
    // no seconds: shown while the hero stands in it
    case "thicket": return hazard.inThicket ? 1 : 0;
    case "snow": return hazard.snowTicks;
    case "meteor": return hazard.meteorTicks;
    case "chill": return hazard.chilled ? 1 : 0;
    case "fire": return hazard.inFire ? 1 : 0;
    case "boots": return buffs.bootsTicks;
    case "berserk": return buffs.berserkTicks;
    case "heal": return buffs.healTicks;
    case "web": return snares.slowTicks;
    case "root": return snares.rootTicks;
  }
}

function labelOf(kind: BuffKind, lang: Lang): string {
  if (kind === "web" || kind === "root") return t(lang, `snare.${kind}`);
  if (kind === "boots" || kind === "berserk" || kind === "heal") return t(lang, `orb.${kind}`);
  return t(lang, `buff.${kind}`);
}

/**
 * The running orb effects and snares, in the order boots, berserk, heal, web, roots, then the natural event: the storm
 * with the steps until its nearest bolt (sim hazardPending), the running sandstorm, the thicket under the hero (no
 * seconds, 0).
 */
export function buffCells(buffs: BuffState, snares: Snares, lang: Lang, hazard: HazardCells = NO_HAZARD): BuffCell[] {
  const out: BuffCell[] = [];
  for (const kind of KINDS) {
    const ticks = ticksOf(buffs, snares, kind, hazard);
    if (ticks <= 0) continue;
    out.push({ kind, seconds: NO_SECONDS.has(kind) ? 0 : Math.ceil(ticks / TICKS_PER_SECOND), label: labelOf(kind, lang) });
  }
  return out;
}

/**
 * Our own glyphs (24 x 24, drawn with the text colour): a boot, an axe, a cross, a web, roots, a lightning bolt,
 * three wavy lines of sand, a thorny branch, a snowflake, an ice cube, a falling comet, a flame.
 */
export const ORB_GLYPHS: Record<BuffKind, string> = {
  boots: '<path d="M8 3h6v10l6 3v4H5v-4l3-3z"/><path d="M2 10h4M1 14h3"/>',
  berserk: '<path d="M7 21L17 5"/><path d="M14 3c4 0 7 3 7 7-3 0-6-1-8-3z"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  web: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/><path d="M12 7l5 5-5 5-5-5z"/>',
  root: '<path d="M12 3v9"/><path d="M12 12c-2 3-5 4-8 5M12 12c2 3 5 4 8 5M12 12v9M8 15c0 3-1 5-3 6M16 15c0 3 1 5 3 6"/>',
  storm: '<path d="M13 2L5 13h6l-2 9 9-12h-6z"/>',
  sand: '<path d="M3 7c3-2 5 2 8 0s5-2 8 0"/><path d="M3 12c3-2 5 2 8 0s5-2 8 0"/><path d="M3 17c3-2 5 2 8 0s5-2 8 0"/>',
  thicket: '<path d="M4 20L20 4"/><path d="M8 16l-3-1M8 16l1 3M12 12l-3-1M12 12l1 3M16 8l-3-1M16 8l1 3M10 14l3-1M14 10l3-1"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  chill: '<path d="M5 8l7-4 7 4v8l-7 4-7-4z"/><path d="M5 8l7 4 7-4M12 12v8"/>',
  meteor: '<circle cx="16" cy="16" r="4"/><path d="M13 13L3 3M16 11L9 4M11 16L4 9"/>',
  fire: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 1 4 3 5 1-3 0-6 0-10z"/>',
};

function glyph(kind: BuffKind): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ORB_GLYPHS[kind]}</svg>`;
}

interface Node {
  root: HTMLElement;
  seconds: HTMLElement;
}

/** The running orb effects, snares and the storm over the ability bar: a glyph with its seconds each, hidden when none runs. */
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

  update(buffs: BuffState, snares: Snares, lang: Lang, hazard: HazardCells = NO_HAZARD): void {
    for (const kind of KINDS) {
      const node = this.nodes.get(kind)!;
      const ticks = ticksOf(buffs, snares, kind, hazard);
      node.root.hidden = ticks <= 0;
      if (ticks <= 0) continue;
      setText(node.seconds, NO_SECONDS.has(kind) ? "" : `${Math.ceil(ticks / TICKS_PER_SECOND)} s`);
      const title = labelOf(kind, lang);
      if (node.root.title !== title) node.root.title = title;
    }
  }
}
