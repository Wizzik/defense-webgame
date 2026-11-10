import { TICKS_PER_SECOND, type Run, xpToNext } from "../../sim";
import { el, formatTime, setText } from "./dom";
import { type Lang, t } from "./i18n";

/** The castle counts as under attack for this long after a hit. */
const ATTACK_BANNER_TICKS = 2 * TICKS_PER_SECOND;

interface Bar {
  fill: HTMLElement;
  label: HTMLElement;
}

function bar(parent: HTMLElement, kind: string): Bar {
  const root = el("div", `bar ${kind}`, parent);
  const fill = el("div", "bar-fill", root);
  const label = el("span", "bar-label", root);
  return { fill, label };
}

function fraction(value: number, max: number): string {
  return `${Math.max(0, Math.min(1, max > 0 ? value / max : 0)) * 100}%`;
}

/** In-run display: hero, time and phase, castle and kills, spell, castle-under-attack banner. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly heroHp: Bar;
  private readonly heroXp: Bar;
  private readonly time: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly castle: Bar;
  private readonly kills: HTMLElement;
  private readonly spellName: HTMLElement;
  private readonly spellState: HTMLElement;
  private readonly spellFill: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly muteKey: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el("div", "hud", parent);
    const left = el("div", "hud-corner hud-left", this.root);
    this.heroHp = bar(left, "hp");
    this.heroXp = bar(left, "xp");
    const center = el("div", "hud-center", this.root);
    this.time = el("div", "hud-time", center);
    this.phase = el("div", "hud-phase", center);
    this.banner = el("div", "hud-banner", center);
    const right = el("div", "hud-corner hud-right", this.root);
    this.castle = bar(right, "castle");
    this.kills = el("div", "hud-kills", right);
    this.muteKey = el("div", "hud-mute", right);
    const spell = el("div", "hud-spell", this.root);
    this.spellName = el("div", "hud-spell-name", spell);
    const track = el("div", "bar cooldown", spell);
    this.spellFill = el("div", "bar-fill", track);
    this.spellState = el("span", "bar-label", track);
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  update(run: Run, lang: Lang): void {
    const { hero, castle, data } = run;
    setText(this.heroHp.label, `${Math.max(0, Math.ceil(hero.hp))} / ${Math.round(hero.stats.maxHp)}`);
    this.heroHp.fill.style.width = fraction(hero.hp, hero.stats.maxHp);
    const next = xpToNext(data.rules, hero.level);
    setText(this.heroXp.label, `${t(lang, "hud.level", { n: hero.level })}  ${Math.floor(hero.xp)} / ${next}`);
    this.heroXp.fill.style.width = fraction(hero.xp, next);

    const total = Math.round(run.durationTicks / TICKS_PER_SECOND);
    setText(this.time, `${formatTime(run.timeSeconds)} / ${formatTime(total)}`);
    setText(this.phase, t(lang, "hud.phase", { n: run.phaseIndex + 1, total: data.rules.phases.length }));
    const attacked = castle.lastHitTick >= 0 && run.tick - castle.lastHitTick <= ATTACK_BANNER_TICKS;
    setText(this.banner, attacked ? t(lang, "hud.castleAttacked") : "");
    this.banner.hidden = !attacked;

    setText(this.castle.label, `${t(lang, "hud.castle")} ${Math.max(0, Math.ceil(castle.hp))} / ${castle.maxHp}`);
    this.castle.fill.style.width = fraction(castle.hp, castle.maxHp);
    setText(this.muteKey, t(lang, "hud.muteKey"));
    setText(this.kills, t(lang, "hud.kills", { n: run.stats.kills }));

    const slot = run.abilities[0];
    if (slot) {
      setText(this.spellName, `${slot.def.name[lang]} · ${t(lang, "hud.level", { n: slot.level })}`);
      const ready = slot.cooldown <= 0;
      setText(this.spellState, ready ? t(lang, "hud.ready") : `${(slot.cooldown / TICKS_PER_SECOND).toFixed(1)} s`);
      const total = slot.def.cooldown[slot.level - 1] * run.hero.stats.cooldownScale * TICKS_PER_SECOND;
      this.spellFill.style.width = ready ? "100%" : fraction(total - slot.cooldown, total);
    }
  }
}
