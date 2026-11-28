import { describe, expect, it } from "vitest";
import type { Ability } from "../../data/schema";
import { NO_INPUT } from "../input";
import { refreshHeroStats } from "../level-up";
import { abilityRun, addEnemy, quietData } from "../testing/ability-run";

/** Stonehorn with his ultimate (slot 3) replaced by a transform and his slot 2 by an armor aura. */
function data(duration = 1) {
  const d = quietData();
  const ult = d.heroes.find((h) => h.id === "stonehorn")!.ultimate;
  const third = d.heroes.find((h) => h.id === "stonehorn")!.signatureAbilities[2];
  const i = d.abilities.findIndex((a) => a.id === ult);
  const j = d.abilities.findIndex((a) => a.id === third);
  const base = d.abilities[i]!;
  d.abilities[i] = {
    id: base.id, name: base.name, description: base.description, targeting: "self", levels: 3,
    cooldown: [10, 10, 10], kind: "transform",
    params: { duration: [duration, duration, duration], hpBonus: [0.5, 0.5, 0.5], armorBonus: [10, 10, 10], damageBonus: [1, 1, 1] },
  } as Ability;
  const aura = d.abilities[j]!;
  d.abilities[j] = {
    id: aura.id, name: aura.name, description: aura.description, targeting: "self", levels: 5,
    cooldown: [0, 0, 0, 0, 0], kind: "aura", params: { armorBonus: [3, 6, 9, 12, 15] },
  } as Ability;
  d.rules.autocast.novaMinEnemies = 1;
  return d;
}

describe("transform (timed self buff) and the armor aura", () => {
  it("an armor aura adds flat armor", () => {
    const run = abilityRun("stonehorn", {}, data());
    const before = run.hero.stats.armor;
    const r2 = abilityRun("stonehorn", { 2: 2 }, data());
    expect(r2.hero.stats.armor).toBeCloseTo(before + 6, 9);
    expect(run.hero.bonus.armor).toBe(0);
  });

  it("waits for a crowd, then adds hp, armor and attack damage for its duration", () => {
    const run = abilityRun("stonehorn", { 3: 1 }, data(1));
    refreshHeroStats(run);
    const hp = run.hero.stats.maxHp;
    const armor = run.hero.stats.armor;
    const dmg = run.hero.stats.damageMax;
    run.step(NO_INPUT);
    expect(run.abilities[3]!.active).toBe(false); // no enemy near
    addEnemy(run, 150, 0);
    run.step(NO_INPUT);
    const slot = run.abilities[3]!;
    expect(slot.active).toBe(true);
    expect(run.hero.stats.maxHp).toBeCloseTo(hp * 1.5, 6);
    expect(run.hero.hp).toBeCloseTo(hp * 1.5, 6);
    expect(run.hero.stats.armor).toBeCloseTo(armor + 10, 9);
    expect(run.hero.stats.damageMax).toBeCloseTo(dmg * 2, 6);
    // its cooldown runs after it ends: duration + cooldown
    expect(slot.cooldown).toBeGreaterThan(30);
    for (let s = 0; s < 31; s++) run.step(NO_INPUT);
    expect(slot.active).toBe(false);
    expect(run.hero.stats.maxHp).toBeCloseTo(hp, 6);
    expect(run.hero.hp).toBeLessThanOrEqual(hp + 1e-6);
    expect(run.hero.hp).toBeGreaterThan(0);
    expect(run.hero.stats.armor).toBeCloseTo(armor, 9);
  });
});
