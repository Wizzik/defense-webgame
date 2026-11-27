import { describe, expect, it } from "vitest";
import { abilityCooldownTicks, ULTIMATE_SLOT } from "./abilities/slots";
import { damageHero, heroDamageScale } from "./combat";
import { EventKind } from "./events";
import { refreshHeroStats } from "./level-up";
import type { GearBonus } from "./gear";
import { updateHeroCombat } from "./hero";
import { applyThorns } from "./thorns";
import { abilityRun, addEnemy, eventsOf } from "./testing/ability-run";

/** The stats random items brought (spec 2026-11-26 random items, section 3; plan stage 2, task 6). */
function withGear(hero: string, gear: Partial<GearBonus>, levels: Record<number, number> = {}) {
  const run = abilityRun(hero, levels);
  Object.assign(run.hero.gear, gear);
  refreshHeroStats(run);
  run.hero.hp = run.hero.stats.maxHp;
  return run;
}

describe("gear stats of random items", () => {
  it("without them nothing changes: no crit, no dodge, full damage taken, the same cooldowns and radii", () => {
    const run = withGear("nightglaive", {});
    const s = run.hero.stats;
    expect([s.critChance, s.dodge, s.thorns]).toEqual([0, 0, 0]);
    expect([s.damageTakenScale, s.ultimateScale, s.areaScale]).toEqual([1, 1, 1]);
    expect(s.critDamage).toBe(run.data.rules.loot.critDamage);
  });

  it("crit chance and dodge stop at their caps, damage taken too", () => {
    const run = withGear("nightglaive", { critChance: 2, dodge: 2, damageTaken: 2 });
    const { caps } = run.data.rules.loot;
    expect(run.hero.stats.critChance).toBe(caps.critChance);
    expect(run.hero.stats.dodge).toBe(caps.dodge);
    expect(run.hero.stats.damageTakenScale).toBeCloseTo(1 - caps.damageTaken, 12);
  });

  it("a crit multiplies the basic attack by 1 + crit damage", () => {
    const plain = withGear("nightglaive", {});
    const crit = withGear("nightglaive", { critDamage: 0.5 });
    crit.hero.stats.critChance = 1; // above the cap on purpose: every attack crits
    for (const run of [plain, crit]) {
      addEnemy(run, 0, 120);
      run.events.clear();
      updateHeroCombat(run);
    }
    const hit = (run: typeof plain) => run.events.value[eventsOf(run, EventKind.Hit)[0]!]!;
    // both runs draw the same damage roll after the crit's draw only in the crit run, so compare the bounds
    const { damageMin, damageMax } = plain.hero.stats;
    expect(hit(plain)).toBeLessThanOrEqual(Math.round(damageMax) + 1e-9);
    expect(hit(crit)).toBeGreaterThanOrEqual(Math.round(damageMin) * 2 * 0.99);
  });

  it("dodge avoids an enemy's hit, not a cloud's step", () => {
    const run = withGear("nightglaive", {});
    run.hero.stats.dodge = 1;
    const i = addEnemy(run, 0, 120);
    const hp = run.hero.hp;
    run.events.clear();
    expect(damageHero(run, 100, i)).toBe(0);
    expect(run.hero.hp).toBe(hp);
    expect(eventsOf(run, EventKind.HeroDodge)).toHaveLength(1);
    expect(damageHero(run, 100, i, 1)).toBeGreaterThan(0);
  });

  it("damage taken lowers every enemy hit", () => {
    const run = withGear("nightglaive", { damageTaken: 0.2 });
    expect(heroDamageScale(run)).toBeCloseTo(2 * 0.8, 12);
    const hp = run.hero.hp;
    damageHero(run, 100, -1);
    expect(hp - run.hero.hp).toBeCloseTo(160, 9);
  });

  it("thorns hit a melee attacker back after the enemies moved, not before", () => {
    const run = withGear("nightglaive", { thorns: 0.5 });
    const i = addEnemy(run, 0, 120);
    const hp = run.enemies.hp[i]!;
    const dealt = damageHero(run, 100, i);
    expect(run.enemies.hp[i]).toBe(hp);
    applyThorns(run);
    expect(hp - run.enemies.hp[i]!).toBeCloseTo(dealt * 0.5, 9);
    applyThorns(run);
    expect(hp - run.enemies.hp[i]!).toBeCloseTo(dealt * 0.5, 9);
  });

  it("cooldown speed shortens every cooldown, ultimate cooldown only the ultimate's", () => {
    const levels = { 0: 1, [ULTIMATE_SLOT]: 1 };
    const plain = withGear("nightglaive", {}, levels);
    const fast = withGear("nightglaive", { cooldownSpeed: 0.25, ultimateCooldown: 1 }, levels);
    const ticks = (run: typeof plain, slot: number) => abilityCooldownTicks(run, run.abilities[slot]!);
    expect(ticks(fast, 0) / ticks(plain, 0)).toBeCloseTo(fast.hero.stats.cooldownScale / plain.hero.stats.cooldownScale, 1);
    expect(fast.hero.stats.cooldownScale).toBeLessThan(plain.hero.stats.cooldownScale);
    expect(ticks(fast, ULTIMATE_SLOT)).toBe(Math.round(
      fast.abilities[ULTIMATE_SLOT]!.def.cooldown[0]! * fast.hero.stats.cooldownScale * 0.5 * 30,
    ));
  });

  it("area size widens a nova's circle", () => {
    const plain = withGear("nightglaive", {}, { 0: 1 });
    const wide = withGear("nightglaive", { areaSize: 0.2 }, { 0: 1 });
    const radius = (run: typeof plain) => {
      addEnemy(run, 0, 100);
      run.events.clear();
      run.step({ moveX: 0, moveY: 0, card: -1, actions: 0 });
      return run.events.value[eventsOf(run, EventKind.Cast)[0]!]!;
    };
    expect(radius(wide)).toBeCloseTo(radius(plain) * 1.2, 9);
  });
});
