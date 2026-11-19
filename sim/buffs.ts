import { TICKS_PER_SECOND, TICK_SECONDS } from "./constants";
import { EventKind } from "./events";
import { refreshHeroStats } from "./level-up";
import type { Run } from "./run";

/** The three orbs on the map and the effects they start (spec 2026-11-19 sustain). */
export const OrbKind = { Boots: 0, Berserk: 1, Heal: 2 } as const;
export type OrbKind = (typeof OrbKind)[keyof typeof OrbKind];

/** Timers of the orb effects and the lifesteal budget of the hero. */
export class BuffState {
  bootsTicks = 0;
  berserkTicks = 0;
  healTicks = 0;
  /** Hp lifesteal may still heal; refilled every step up to capPerSecond x max hp (one second). */
  lifestealBudget = 0;
  /** Hp lifesteal healed in this step; reported once at the end of the step. */
  lifestealStep = 0;
  /** Hp the heal orb healed since its last report (once a second). */
  healCarry = 0;
}

/** Heals the living hero by up to `amount`, never above max hp; returns the hp healed (0 for a fallen hero). */
export function healHero(run: Run, amount: number): number {
  const hero = run.hero;
  if (hero.hp <= 0 || amount <= 0) return 0;
  const healed = Math.min(amount, Math.max(hero.stats.maxHp - hero.hp, 0));
  hero.hp += healed;
  return healed;
}

/** Starts (or restarts at full length) the effect of an orb; the same orb again does not stack. */
export function startBuff(run: Run, kind: OrbKind): void {
  const ticks = Math.round(run.data.rules.sustain.buffSeconds * TICKS_PER_SECOND);
  const buffs = run.buffs;
  if (kind === OrbKind.Boots) {
    buffs.bootsTicks = ticks;
    if (run.hero.speedScale !== run.data.rules.sustain.boots.moveSpeed) {
      run.hero.speedScale = run.data.rules.sustain.boots.moveSpeed;
      refreshHeroStats(run);
    }
  } else if (kind === OrbKind.Berserk) {
    buffs.berserkTicks = ticks;
  } else {
    buffs.healTicks = ticks;
  }
}

/** Multiplier on all damage the hero deals (attacks, spells, summons) while berserk runs. */
export function berserkScale(run: Run): number {
  return run.buffs.berserkTicks > 0 ? run.data.rules.sustain.berserk.damage : 1;
}

/**
 * Heals the hero by `lifesteal` x `dealt` (damage without overkill) from the budget; damageEnemy calls it for
 * base attacks and spells.
 */
export function lifestealOnHit(run: Run, dealt: number): void {
  const share = run.hero.gear.lifesteal;
  if (share <= 0 || dealt <= 0) return;
  const buffs = run.buffs;
  const healed = healHero(run, Math.min(share * dealt, buffs.lifestealBudget));
  if (healed <= 0) return;
  buffs.lifestealBudget -= healed;
  buffs.lifestealStep += healed;
  run.stats.healedLifesteal += healed;
}

/** Fills the lifesteal budget to its maximum (the start of a run). */
export function fillLifestealBudget(run: Run): void {
  run.buffs.lifestealBudget = run.data.rules.sustain.lifesteal.capPerSecond * run.hero.stats.maxHp;
}

/**
 * Once per step, at its end: counts the effects down (boots end -> speed back), heals over time, refills the
 * lifesteal budget and reports the lifesteal of the step as one HeroHeal event.
 */
export function updateBuffs(run: Run): void {
  const buffs = run.buffs;
  const hero = run.hero;
  const sustain = run.data.rules.sustain;
  if (buffs.bootsTicks > 0 && --buffs.bootsTicks === 0) {
    hero.speedScale = 1;
    refreshHeroStats(run);
  }
  if (buffs.berserkTicks > 0) buffs.berserkTicks--;
  if (buffs.healTicks > 0) {
    const perTick = (sustain.heal.share * hero.stats.maxHp) / (sustain.buffSeconds * TICKS_PER_SECOND);
    const healed = healHero(run, perTick);
    buffs.healCarry += healed;
    run.stats.healedOrb += healed;
    buffs.healTicks--;
    if (buffs.healTicks % TICKS_PER_SECOND === 0) {
      if (buffs.healCarry > 0) run.events.push(EventKind.HeroHeal, 0, buffs.healCarry, hero.x, hero.y, 2, 0);
      buffs.healCarry = 0;
    }
  }
  const max = sustain.lifesteal.capPerSecond * hero.stats.maxHp;
  buffs.lifestealBudget = Math.min(buffs.lifestealBudget + max * TICK_SECONDS, max);
  if (buffs.lifestealStep > 0) {
    run.events.push(EventKind.HeroHeal, 0, buffs.lifestealStep, hero.x, hero.y, 1, 0);
    buffs.lifestealStep = 0;
  }
}
