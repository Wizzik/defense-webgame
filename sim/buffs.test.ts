import { describe, expect, it } from "vitest";
import { berserkScale, healHero, OrbKind, startBuff, updateBuffs } from "./buffs";
import { damageEnemy } from "./combat";
import { EventKind } from "./events";
import { refreshHeroStats } from "./level-up";
import { abilityRun, addEnemy, eventsOf, quietData } from "./testing/ability-run";

function run(capPerSecond?: number) {
  const data = quietData();
  if (capPerSecond !== undefined) data.rules.sustain.lifesteal.capPerSecond = capPerSecond;
  return abilityRun("stonehorn", {}, data);
}

describe("buffs", () => {
  it("boots doubles move speed for 15 s and restores it once", () => {
    const r = run();
    const base = r.hero.stats.moveSpeed;
    startBuff(r, OrbKind.Boots);
    expect(r.hero.stats.moveSpeed).toBeCloseTo(base * 2, 9);
    for (let i = 0; i < 449; i++) updateBuffs(r);
    expect(r.hero.stats.moveSpeed).toBeCloseTo(base * 2, 9);
    updateBuffs(r);
    expect(r.hero.stats.moveSpeed).toBeCloseTo(base, 9);
    expect(r.hero.speedScale).toBe(1);
    expect(r.buffs.bootsTicks).toBe(0);
  });

  it("same orb again refreshes, does not stack", () => {
    const r = run();
    startBuff(r, OrbKind.Berserk);
    for (let i = 0; i < 300; i++) updateBuffs(r);
    expect(r.buffs.berserkTicks).toBe(150);
    startBuff(r, OrbKind.Berserk);
    expect(r.buffs.berserkTicks).toBe(450);
    const base = r.hero.stats.moveSpeed;
    startBuff(r, OrbKind.Boots);
    startBuff(r, OrbKind.Boots);
    expect(r.hero.stats.moveSpeed).toBeCloseTo(base * 2, 9);
  });

  it("berserk scales every source", () => {
    const r = run();
    startBuff(r, OrbKind.Berserk);
    expect(berserkScale(r)).toBe(1.5);
    for (const source of [0, 1, 2] as const) {
      const slot = addEnemy(r, 300, 0, 1000);
      damageEnemy(r, slot, 100, source);
      expect(r.enemies.hp[slot]).toBe(850);
    }
  });

  it("lifesteal heals from attacks and spells only, without overkill", () => {
    const r = run(1);
    const max = r.hero.stats.maxHp;
    r.hero.gear.lifesteal = 0.1;
    r.hero.hp = max / 2;
    damageEnemy(r, addEnemy(r, 300, 0, 1000), 100, 0);
    expect(r.hero.hp).toBeCloseTo(max / 2 + 10, 9);
    damageEnemy(r, addEnemy(r, 300, 0, 1000), 100, 1);
    expect(r.hero.hp).toBeCloseTo(max / 2 + 20, 9);
    damageEnemy(r, addEnemy(r, 300, 0, 1000), 100, 2);
    expect(r.hero.hp).toBeCloseTo(max / 2 + 20, 9);
    damageEnemy(r, addEnemy(r, 300, 0, 40), 500, 1);
    expect(r.hero.hp).toBeCloseTo(max / 2 + 24, 9);
    expect(r.stats.healedLifesteal).toBeCloseTo(24, 9);
  });

  it("lifesteal budget caps at one second", () => {
    const r = run(0.02);
    const max = r.hero.stats.maxHp;
    for (let i = 0; i < 300; i++) updateBuffs(r);
    expect(r.buffs.lifestealBudget).toBeCloseTo(0.02 * max, 9);
    r.hero.gear.lifesteal = 0.5;
    r.hero.hp = 1;
    damageEnemy(r, addEnemy(r, 300, 0, 1e6), 1e5, 0);
    expect(r.hero.hp).toBeCloseTo(1 + 0.02 * max, 9);
    damageEnemy(r, addEnemy(r, 300, 0, 1e6), 1e5, 0);
    expect(r.hero.hp).toBeCloseTo(1 + 0.02 * max, 9);
    updateBuffs(r);
    expect(r.buffs.lifestealBudget).toBeCloseTo(0.02 * max / 30, 9);
  });

  it("heal orb restores max hp over 15 s and follows max hp", () => {
    const r = run();
    r.hero.hp = 1;
    startBuff(r, OrbKind.Heal);
    for (let i = 0; i < 450; i++) {
      if (i === 200) {
        r.hero.gear.hp += 500;
        refreshHeroStats(r);
      }
      updateBuffs(r);
      expect(r.hero.hp).toBeLessThanOrEqual(r.hero.stats.maxHp + 1e-9);
    }
    expect(r.hero.hp).toBeCloseTo(r.hero.stats.maxHp, 6);
    expect(r.buffs.healTicks).toBe(0);
    expect(r.stats.healedOrb).toBeGreaterThan(0);
  });

  it("dead hero does not heal", () => {
    const r = run(1);
    r.hero.hp = 0;
    expect(healHero(r, 100)).toBe(0);
    r.hero.gear.lifesteal = 0.1;
    startBuff(r, OrbKind.Heal);
    damageEnemy(r, addEnemy(r, 300, 0, 1000), 100, 0);
    for (let i = 0; i < 60; i++) updateBuffs(r);
    expect(r.hero.hp).toBe(0);
  });

  it("heal events are summed", () => {
    const r = run(1);
    r.hero.gear.lifesteal = 0.1;
    r.hero.hp = r.hero.stats.maxHp / 2;
    r.events.clear();
    damageEnemy(r, addEnemy(r, 300, 0, 1000), 100, 0);
    damageEnemy(r, addEnemy(r, 300, 0, 1000), 50, 1);
    updateBuffs(r);
    const heals = eventsOf(r, EventKind.HeroHeal);
    expect(heals.length).toBe(1);
    expect(r.events.u[heals[0]!]).toBe(1);
    expect(r.events.value[heals[0]!]).toBeCloseTo(15, 9);
    expect(r.buffs.lifestealStep).toBe(0);
  });

  it("the heal orb reports once a second", () => {
    const r = run();
    r.hero.hp = 1;
    startBuff(r, OrbKind.Heal);
    let reports = 0;
    for (let i = 0; i < 90; i++) {
      r.events.clear();
      updateBuffs(r);
      for (const k of eventsOf(r, EventKind.HeroHeal)) if (r.events.u[k] === 2) reports++;
    }
    expect(reports).toBe(3);
  });
});
