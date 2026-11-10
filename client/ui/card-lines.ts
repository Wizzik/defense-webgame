import type { Card, Run } from "../../sim";
import { heroStats } from "../../sim";
import type { HeroStats } from "../../sim";
import type { MessageKey } from "./i18n";
import { messagesEn } from "./messages-en";

export interface CardLine {
  label: MessageKey;
  from: string;
  to: string;
}

/** Whole numbers stay whole; anything else gets one decimal. */
function num(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function whole(value: number): string {
  return String(Math.round(value));
}

/** "+24 %" or "−19 %" for a ratio relative to 1. */
function percent(ratio: number): string {
  const p = Math.round((ratio - 1) * 100);
  return p < 0 ? `−${-p} %` : `+${p} %`;
}

function statLabel(key: string): MessageKey | null {
  const label = `stat.${key}`;
  return label in messagesEn ? (label as MessageKey) : null;
}

function abilityLines(run: Run, card: Extract<Card, { kind: "ability" }>): CardLine[] {
  const { def } = run.abilities[card.slot];
  const { spellPower } = run.hero.stats;
  // fromLevel 0 is learning: only the level 1 values are shown, with an empty "from".
  const learn = card.fromLevel === 0;
  const from = learn ? card.toLevel - 1 : card.fromLevel - 1;
  const to = card.toLevel - 1;
  const lines: CardLine[] = [];
  for (const [key, values] of Object.entries(def.params as Record<string, number[]>)) {
    if (!learn && values[from] === values[to]) continue;
    const label = statLabel(key);
    if (!label) continue;
    if (key === "damage") {
      lines.push({
        label, from: learn ? "" : whole(values[from] * spellPower), to: whole(values[to] * spellPower),
      });
    } else {
      lines.push({ label, from: learn ? "" : num(values[from]), to: num(values[to]) });
    }
  }
  if (learn || def.cooldown[from] !== def.cooldown[to]) {
    lines.push({ label: "stat.cooldown", from: learn ? "" : num(def.cooldown[from]), to: num(def.cooldown[to]) });
  }
  return lines;
}

function statsWith(run: Run, attribute: "str" | "agi" | "int", amount: number): [HeroStats, HeroStats] {
  const { hero, data } = run;
  const blank = (): HeroStats => ({ ...hero.stats });
  // The copy carries the aura bonuses so the preview uses the same formulas as the sim.
  const before = heroStats(data, { ...hero, bonus: { ...hero.bonus } }, blank());
  const after = heroStats(data, { ...hero, bonus: { ...hero.bonus }, [attribute]: hero[attribute] + amount }, blank());
  return [before, after];
}

/** What a card changes, as before and after values ready to show. */
export function cardLines(run: Run, card: Card): CardLine[] {
  if (card.kind === "ability") return abilityLines(run, card);
  const [a, b] = statsWith(run, card.attribute, card.amount);
  const base = run.hero.def.baseAttack.cooldown;
  switch (card.attribute) {
    case "str":
      return [
        { label: "stat.maxHp", from: whole(a.maxHp), to: whole(b.maxHp) },
        { label: "stat.regen", from: num(a.regenPerSecond), to: num(b.regenPerSecond) },
      ];
    case "agi":
      return [
        { label: "stat.armor", from: num(a.armor), to: num(b.armor) },
        {
          label: "stat.attackSpeed",
          from: percent(base / a.attackIntervalSeconds),
          to: percent(base / b.attackIntervalSeconds),
        },
      ];
    case "int":
      return [
        { label: "stat.spellPower", from: percent(a.spellPower), to: percent(b.spellPower) },
        { label: "stat.cooldownScale", from: percent(a.cooldownScale), to: percent(b.cooldownScale) },
      ];
  }
}
