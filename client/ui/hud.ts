import {
  chestPrice, EventKind, isEmptySlot, passiveSlotRange, sharedSlotRange, TICKS_PER_SECOND, type Run, ULTIMATE_SLOT,
  xpToNext,
  runMagicFind,
  hazardPending,
  inThicket,
  WeatherPhase,
} from "../../sim";
import { abilityIconSvg } from "./ability-icons";
import { Announcer } from "./announcer";
import { BossBar } from "./boss-bar";
import { BuffBar } from "./buff-bar";
import { el, formatTime, setText } from "./dom";
import type { Drop } from "../../meta";
import { chestLootLine, dropLine } from "./drop-lines";
import { type Lang, type MessageKey, t } from "./i18n";

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
  /** The ability slot it shows (-1 for the dash). */
  slot: number;
  root: HTMLElement;
  name: HTMLElement;
  state: HTMLElement;
  fill: HTMLElement;
  /** Ultimate only. */
  mode?: HTMLElement;
  /** The spell's icon; `shown` is the ability id it shows ("" for none). */
  icon: HTMLElement;
  shown: string;
}

function cell(parent: HTMLElement, slot: number, extra: string, key?: string, withMode = false): Cell {
  const root = el("div", `cell ${extra}`, parent);
  if (key) el("span", "cell-key", root, key);
  const icon = el("span", "cell-icon", root);
  const name = el("div", "cell-name", root);
  const state = el("div", "cell-state", root);
  const mode = withMode ? el("div", "cell-mode", root) : undefined;
  const track = el("div", "cell-track", root);
  const fill = el("div", "bar-fill", track);
  return { slot, root, name, state, fill, mode, icon, shown: "" };
}

/** A small cell of the passive row: the glyph and the level; a muted frame while the slot is empty. */
interface PassiveCell {
  slot: number;
  root: HTMLElement;
  icon: HTMLElement;
  level: HTMLElement;
  /** The ability id the icon shows ("" for an empty slot). */
  shown: string;
}

/** In-run display: hero, time and phase, news line, boss bar, castle and kills, orb effects, ability bar, castle-under-attack banner. */
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
  private readonly passives: PassiveCell[] = [];
  private readonly abilityRow: HTMLElement;
  private readonly passiveRow: HTMLElement;
  /** Slot count the rows were built for (0 = not built yet). */
  private builtFor = 0;
  private dash!: Cell;
  private readonly banner: HTMLElement;
  private readonly muteKey: HTMLElement;
  private readonly announce: HTMLElement;
  private readonly announcer = new Announcer();
  private readonly bossBar: BossBar;
  private readonly buffBar: BuffBar;
  private thicketRun: Run | null = null;
  private readonly hazardCells = { stormTicks: 0, sandTicks: 0, inThicket: false };
  private lastRun: Run | null = null;
  /** What a boss that just fell dropped (boss id, its order in the run); main.ts sets it. */
  /** The drop of a fallen boss; `magicFind` is the hero's magic find at that moment. */
  dropFor: ((bossId: string, order: number, magicFind: number) => Drop) | null = null;
  /** Called with the rarity class ("rarity-legendary", "rarity-mythic") of a top-rarity drop or chest pick. */
  onLoot: ((tone: string) => void) | null = null;

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
    abilities.id = "hud-abilities";
    this.buffBar = new BuffBar(abilities);
    this.abilityRow = el("div", "hud-ability-row", abilities);
    this.passiveRow = el("div", "hud-passive-row", abilities);
  }

  /**
   * Builds the rows for the slots of `run`: the signature spells, the shared spells and the ultimate (with R and
   * the auto switch), then the dash; under them the passives.
   */
  private build(run: Run): void {
    if (this.builtFor === run.abilities.length) return;
    this.builtFor = run.abilities.length;
    this.cells.length = 0;
    this.passives.length = 0;
    this.abilityRow.replaceChildren();
    this.passiveRow.replaceChildren();
    const [sharedFirst, sharedEnd] = sharedSlotRange(run);
    const order: number[] = [];
    for (let i = 0; i < ULTIMATE_SLOT; i++) order.push(i);
    for (let i = sharedFirst; i < sharedEnd; i++) order.push(i);
    order.push(ULTIMATE_SLOT);
    for (const slot of order) {
      const ultimate = slot === ULTIMATE_SLOT;
      const extra = ultimate ? "ultimate" : slot >= sharedFirst ? "spell shared" : "spell";
      const view = cell(this.abilityRow, slot, extra, ultimate ? "R" : undefined, ultimate);
      view.root.dataset.slot = String(slot);
      this.cells.push(view);
    }
    this.dash = cell(this.abilityRow, -1, "dash");
    const [passiveFirst, passiveEnd] = passiveSlotRange(run);
    for (let slot = passiveFirst; slot < passiveEnd; slot++) {
      const root = el("div", "passive-cell empty", this.passiveRow);
      root.dataset.slot = String(slot);
      const icon = el("span", "passive-icon", root);
      const level = el("span", "passive-level", root);
      this.passives.push({ slot, root, icon, level, shown: "" });
    }
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** After every simulation step: ages the news line and reads the events that make news. */
  onEvents(run: Run, lang: Lang): void {
    this.sync(run);
    this.announcer.step();
    // a thicket world names its brakes once, in the first step of a run
    if (run !== this.thicketRun) {
      this.thicketRun = run;
      if (run.data.worlds[run.world - 1]!.hazard.kind === "thicket") this.announcer.push(t(lang, "announce.thicket"), ANNOUNCE_TICKS);
    }
    const { events } = run;
    let faction = "";
    for (let i = 0; i < events.count; i++) {
      const kind = events.kind[i];
      if (kind === EventKind.RushWarning) {
        this.announcer.push(t(lang, "announce.rush"), Math.round(events.value[i]! * TICKS_PER_SECOND));
      } else if (kind === EventKind.BossSpawn) {
        const name = run.data.enemies[events.value[i]!]!.name[lang];
        this.announcer.push(t(lang, "announce.boss", { name }), ANNOUNCE_TICKS);
      } else if (kind === EventKind.BossDeath && this.dropFor) {
        const line = dropLine(lang, this.dropFor(run.data.enemies[events.a[i]!]!.id, events.value[i]!, runMagicFind(run)));
        this.announcer.push(line.text, ANNOUNCE_TICKS, line.tone);
        this.loot(line.tone);
      } else if (kind === EventKind.ChestPick) {
        const line = chestLootLine(lang, run.data, events.u[i]!, events.v[i]!);
        if (line) {
          this.announcer.push(line.text, ANNOUNCE_TICKS, line.tone);
          this.loot(line.tone);
        }
      } else if (kind === EventKind.HazardWave) {
        // the storm's first wave (u = 0) and a weather's warning; a weather's start and end stay quiet
        const u = events.u[i]!;
        if (u === 0) this.announcer.push(t(lang, "announce.storm"), ANNOUNCE_TICKS);
        else if (u === WeatherPhase.Warn) this.announcer.push(t(lang, "announce.sand"), ANNOUNCE_TICKS);
      } else if (kind === EventKind.Faction) {
        faction = run.data.rules.factions[events.a[i]!]!.id;
      } else if (kind === EventKind.Enrage) {
        const name = run.data.enemies[run.finalBossType]!.name[lang];
        this.announcer.push(t(lang, "announce.enrage", { name }), ANNOUNCE_TICKS);
      }
    }
    // a new faction waits behind the news of its step (a boss comes in the same step at 4:10 and 8:20)
    if (faction !== "" && faction !== "human") this.announcer.queue(t(lang, `announce.faction.${faction}` as MessageKey), ANNOUNCE_TICKS);
  }

  private loot(tone: string): void {
    if (tone === "rarity-legendary" || tone === "rarity-mythic") this.onLoot?.(tone);
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
    const tone = this.announcer.tone;
    if (this.announce.dataset.tone !== tone) {
      this.announce.dataset.tone = tone;
      this.announce.className = tone === "" ? "hud-announce" : `hud-announce loot ${tone}`;
    }
    this.announce.hidden = news === "";
    this.bossBar.update(run, lang);
    const attacked = castle.lastHitTick >= 0 && run.tick - castle.lastHitTick <= ATTACK_BANNER_TICKS;
    setText(this.banner, attacked ? t(lang, "hud.castleAttacked") : "");
    this.banner.hidden = !attacked;

    setText(this.castle.label, `${t(lang, "hud.castle")} ${Math.max(0, Math.ceil(castle.hp))} / ${castle.maxHp}`);
    this.castle.fill.style.width = fraction(castle.hp, castle.maxHp);
    setText(this.muteKey, `${t(lang, "gear.key")} · ${t(lang, "settings.key")} · ${t(lang, "hud.muteKey")}`);
    setText(this.kills, t(lang, "hud.kills", { n: run.stats.kills }));

    this.hazardCells.stormTicks = hazardPending(run);
    this.hazardCells.sandTicks = run.hazard.weatherTicks;
    this.hazardCells.inThicket = inThicket(run.map, run.hero.x, run.hero.y);
    this.buffBar.update(run.buffs, run.hero, lang, this.hazardCells);
    this.updateAbilities(run, lang);
  }
  private updateAbilities(run: Run, lang: Lang): void {
    this.build(run);
    for (let i = 0; i < this.cells.length; i++) {
      const view = this.cells[i]!;
      const slot = run.abilities[view.slot]!;
      const learned = slot.level >= 1;
      const empty = isEmptySlot(slot);
      view.root.classList.toggle("dim", !learned);
      view.root.classList.toggle("empty", empty);
      // a charged empowered strike (an armed on_hit ability) lights the frame
      view.root.classList.toggle("charged", learned && slot.def.kind === "on_hit" && slot.active);
      setText(view.name, empty ? t(lang, "hud.emptySlot") : slot.def.name[lang]);
      const iconId = empty ? "" : slot.def.id;
      if (view.shown !== iconId) {
        view.shown = iconId;
        view.icon.innerHTML = iconId ? abilityIconSvg(iconId) : "";
      }
      if (!learned) {
        setText(view.state, empty ? "" : t(lang, "hud.notLearned"));
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
    for (const view of this.passives) {
      const slot = run.abilities[view.slot]!;
      const empty = isEmptySlot(slot);
      if (view.shown !== slot.def.id) {
        view.shown = slot.def.id;
        view.icon.innerHTML = empty ? "" : abilityIconSvg(slot.def.id);
        view.root.classList.toggle("empty", empty);
      }
      setText(view.level, empty ? "" : String(slot.level));
      const title = empty ? t(lang, "hud.emptySlot") : `${slot.def.name[lang]} · ${t(lang, "hud.level", { n: slot.level })}`;
      if (view.root.title !== title) view.root.title = title;
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
