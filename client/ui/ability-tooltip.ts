import type { Run } from "../../sim";
import { slotLines } from "./card-lines";
import { el } from "./dom";
import { type Lang, t } from "./i18n";

/** The text of a spell's tooltip in the ability bar. */
export interface AbilityTooltipInfo {
  name: string;
  /** "Level 3 / 10". */
  sub: string;
  description: string;
  /** "Now → next level" above the lines; empty at the top level. */
  nextHeading: string;
  /** "Damage: 212 → 300"; at the top level only the value. */
  lines: string[];
}

/** The tooltip of ability slot `slot` of the local hero, or null for an empty slot. */
export function abilityTooltip(run: Run, slot: number, lang: Lang): AbilityTooltipInfo | null {
  const ability = run.abilities[slot];
  if (ability === undefined || ability.level <= 0) return null;
  const { def, level } = ability;
  const top = level >= def.levels;
  const lines = slotLines(run, slot).map((line) =>
    line.to === "" ? `${t(lang, line.label)}: ${line.from}` : `${t(lang, line.label)}: ${line.from} → ${line.to}`,
  );
  return {
    name: def.name[lang],
    sub: t(lang, top ? "abilityTip.top" : "abilityTip.level", { n: level, max: def.levels }),
    description: def.description[lang],
    nextHeading: top || lines.length === 0 ? "" : t(lang, "abilityTip.next"),
    lines,
  };
}

/** One floating box over the ability bar; the HUD fills it while the pointer rests on a cell. */
export class AbilityTooltipView {
  private readonly root: HTMLElement;
  private shownKey = "";

  constructor(parent: HTMLElement) {
    this.root = el("div", "item-tooltip ability-tooltip", parent);
    this.root.id = "ability-tooltip";
    this.root.hidden = true;
  }

  /** Shows `info` above `anchor`; rebuilds the box only when its text changed. */
  show(anchor: HTMLElement, info: AbilityTooltipInfo): void {
    const key = `${info.name}|${info.sub}|${info.lines.join("|")}`;
    if (key !== this.shownKey) {
      this.shownKey = key;
      this.root.replaceChildren();
      el("div", "tooltip-name", this.root, info.name);
      el("div", "tooltip-sub", this.root, info.sub);
      el("div", "tooltip-line ability-tip-description", this.root, info.description);
      if (info.nextHeading !== "") el("div", "tooltip-source ability-tip-next", this.root, info.nextHeading);
      for (const line of info.lines) el("div", "tooltip-line", this.root, line);
    }
    this.root.hidden = false;
    const box = anchor.getBoundingClientRect();
    const own = this.root.getBoundingClientRect();
    const left = Math.max(4, Math.min(window.innerWidth - own.width - 4, box.left + box.width / 2 - own.width / 2));
    const top = Math.max(4, box.top - own.height - 8);
    this.root.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
