import { chestPrice, EventKind, TICKS_PER_SECOND, type Run, ULTIMATE_SLOT, xpToNext } from "../../sim";
import { Announcer } from "./announcer";
import { BossBar } from "./boss-bar";
import { el, formatTime, setText } from "./dom";
import { type Lang, t } from "./i18n";

/** How long the news of a boss or of an enrage stays (a rush stays for its warning time). */
const ANNOUNCE_TICKS = 4 * TICKS_PER_SECOND;
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

/** One cell of the ability bar: name, state line, cooldown bar, and for the ultimate a key and the auto switch. */
interface Cell {
  root: HTMLElement;
  name: HTMLElement;
  state: HTMLElement;
  fill: HTMLElement;
  /** Ultimate only. */
  mode?: HTMLElement;
}

function cell(parent: HTMLElement, extra: string, key?: string, withMode = false): Cell {
  const root = el("div", `cell ${extra}`, parent);
  if (key) el("span", "cell-key", root, key);
  const name = el("div", "cell-name", root);
  const state = el("div", "cell-state", root);
  const mode = withMode ? el("div", "cell-mode", root) : undefined;
  const track = el("div", "cell-track", root);
  const fill = el("div", "bar-fill", track);
  return { root, name, state, fill, mode };
}

/** In-run display: hero, time and phase, news line, boss bar, castle and kills, ability bar, castle-under-attack banner. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly heroHp: Bar;
  private readonly heroXp: Bar;
  private readonly gold: HTMLElement;
  private readonly time: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly castle: Bar;
  private readonly kills: HTMLElement;
  private readonly cells: Cell[] = [];
  private readonly dash: Cell;
  private readonly banner: HTMLElement;
  private readonly muteKey: HTMLElement;
  private readonly announce: HTMLElement;
  private readonly announcer = new Announcer();
  private readonly bossBar: BossBar;
  private lastRun: Run | null = null;

  constructor(parent: HTMLElement) {
    this.root = el("div", "hud", parent);
    const left = el("div", "hud-corner hud-left", this.root);
    this.heroHp = bar(left, "hp");
    this.heroXp = bar(left, "xp");
    this.gold = el("div", "hud-gold", left);
    this.gold.id = "hud-gold";
    const center = el("div", "hud-center", this.root);
    this.time = el("div", "hud-time", center);
    this.phase = el("div", "hud-phase", center);
    this.announce = el("div", "hud-announce", center);
    this.announce.id = "announce";
    this.announce.hidden = true;
    this.bossBar = new BossBar(center);
    this.banner = el("div", "hud-banner", center);
    const right = el("div", "hud-corner hud-right", this.root);
    this.castle = bar(right, "castle");
    this.kills = el("div", "hud-kills", right);
    this.muteKey = el("div", "hud-mute", right);
    const abilities = el("div", "hud-abilities", this.root);
    for (let i = 0; i <= ULTIMATE_SLOT; i++) {
      const ultimate = i === ULTIMATE_SLOT;
      this.cells.push(cell(abilities, ultimate ? "ultimate" : "spell", ultimate ? "R" : undefined, ultimate));
    }
    this.dash = cell(abilities, "dash");
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** After every simulation step: ages the news line and reads the events that make news. */
  onEvents(run: Run, lang: Lang): void {
    this.sync(run);
    this.announcer.step();
    const { events } = run;
    for (let i = 0; i < events.count; i++) {
      const kind = events.kind[i];
      if (kind === EventKind.RushWarning) {
        this.announcer.push(t(lang, "announce.rush"), Math.round(events.value[i]! * TICKS_PER_SECOND));
      } else if (kind === EventKind.BossSpawn) {
        const name = run.data.enemies[events.value[i]!]!.name[lang];
        this.announcer.push(t(lang, "announce.boss", { name }), ANNOUNCE_TICKS);
      } else if (kind === EventKind.Enrage) {
        const name = run.data.enemies[run.finalBossType]!.name[lang];
        this.announcer.push(t(lang, "announce.enrage", { name }), ANNOUNCE_TICKS);
      }
    }
  }

  /** A new run starts with no news. */
  private sync(run: Run): void {
    if (run === this.lastRun) return;
    this.lastRun = run;
    this.announcer.clear();
  }

  update(run: Run, lang: Lang): void {
    this.sync(run);
    const { hero, castle, data } = run;
    setText(this.heroHp.label, `${Math.max(0, Math.ceil(hero.hp))} / ${Math.round(hero.stats.maxHp)}`);
    this.heroHp.fill.style.width = fraction(hero.hp, hero.stats.maxHp);
    const next = xpToNext(data.rules, hero.level);
    setText(this.heroXp.label, `${t(lang, "hud.level", { n: hero.level })}  ${Math.floor(hero.xp)} / ${next}`);
    this.heroXp.fill.style.width = fraction(hero.xp, next);
    setText(this.gold, `${t(lang, "hud.gold", { n: run.gold })} · ${t(lang, "hud.chestPrice", { n: chestPrice(run) })}`);

    const total = Math.round(run.durationTicks / TICKS_PER_SECOND);
    setText(this.time, `${formatTime(run.timeSeconds)} / ${formatTime(total)}`);
    setText(
      this.phase,
      run.inFinale ? t(lang, "hud.finale") : t(lang, "hud.phase", { n: run.phaseIndex + 1, total: data.rules.phases.length }),
    );
    const news = this.announcer.text;
    setText(this.announce, news);
    this.announce.hidden = news === "";
    this.bossBar.update(run, lang);
    const attacked = castle.lastHitTick >= 0 && run.tick - castle.lastHitTick <= ATTACK_BANNER_TICKS;
    setText(this.banner, attacked ? t(lang, "hud.castleAttacked") : "");
    this.banner.hidden = !attacked;

    setText(this.castle.label, `${t(lang, "hud.castle")} ${Math.max(0, Math.ceil(castle.hp))} / ${castle.maxHp}`);
    this.castle.fill.style.width = fraction(castle.hp, castle.maxHp);
    setText(this.muteKey, t(lang, "hud.muteKey"));
    setText(this.kills, t(lang, "hud.kills", { n: run.stats.kills }));

    this.updateAbilities(run, lang);
  }
  private updateAbilities(run: Run, lang: Lang): void {
    for (let i = 0; i < this.cells.length; i++) {
      const view = this.cells[i]!;
      const slot = run.abilities[i]!;
      const learned = slot.level >= 1;
      view.root.classList.toggle("dim", !learned);
      // a charged empowered strike (an armed on_hit ability) lights the frame
      view.root.classList.toggle("charged", learned && slot.def.kind === "on_hit" && slot.active);
      setText(view.name, slot.def.name[lang]);
      if (!learned) {
        setText(view.state, t(lang, "hud.notLearned"));
        view.fill.style.width = "0%";
      } else {
        const ready = slot.cooldown <= 0;
        const base = slot.def.cooldown[slot.level - 1]! * run.hero.stats.cooldownScale * TICKS_PER_SECOND;
        setText(
          view.state,
          `${t(lang, "hud.level", { n: slot.level })} · ${
            ready ? t(lang, "hud.ready") : `${(slot.cooldown / TICKS_PER_SECOND).toFixed(1)} s`
          }`,
        );
        view.fill.style.width = ready ? "100%" : fraction(base - slot.cooldown, base);
      }
      if (view.mode) {
        setText(
          view.mode,
          `${t(lang, run.ultimateAuto ? "hud.auto" : "hud.manual")} · ${t(lang, "hud.toggleKey")}`,
        );
      }
    }
    const { hero } = run;
    const total = Math.round(run.data.rules.hero.dash.cooldownSeconds * TICKS_PER_SECOND);
    setText(this.dash.name, t(lang, "hud.dash"));
    setText(
      this.dash.state,
      hero.dashCooldown <= 0 ? t(lang, "hud.ready") : `${(hero.dashCooldown / TICKS_PER_SECOND).toFixed(1)} s`,
    );
    this.dash.fill.style.width = hero.dashCooldown <= 0 ? "100%" : fraction(total - hero.dashCooldown, total);
  }
}
