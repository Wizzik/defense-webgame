import { describe, expect, it } from "vitest";
import { NO_INPUT } from "../input";
import { abilityRun, quietData } from "../testing/ability-run";
import { gainXp } from "../level-up";

function auraParams(data: ReturnType<typeof quietData>, id: string) {
  const ab = data.abilities.find((a) => a.id === id);
  if (!ab || ab.kind !== "aura") throw new Error("test setup");
  return {
    damageBonus: ab.params.damageBonus ?? [0, 0, 0, 0, 0],
    moveSpeedBonus: ab.params.moveSpeedBonus ?? [0, 0, 0, 0, 0],
    attackSpeedBonus: ab.params.attackSpeedBonus ?? [0, 0, 0, 0, 0],
  };
}

describe("aura", () => {
  it("swift pace speeds up movement and attacks", () => {
    const data = quietData();
    const p = auraParams(data, "swift-pace");
    const plain = abilityRun("nightglaive", {}, data);
    const run = abilityRun("nightglaive", { 2: 1 }, data);
    const { constants: c } = data;
    const hero = run.hero;
    expect(hero.bonus.moveSpeed).toBe(p.moveSpeedBonus[0]);
    expect(hero.bonus.attackSpeed).toBe(p.attackSpeedBonus[0]);
    expect(hero.stats.moveSpeed).toBeCloseTo(hero.def.moveSpeed * (1 + p.moveSpeedBonus[0]), 9);
    expect(hero.stats.attackIntervalSeconds).toBeCloseTo(
      hero.def.baseAttack.cooldown
        / Math.min(1 + hero.agi * c.agiAttackSpeedBonus + p.attackSpeedBonus[0], 1 + c.attackSpeedCap), 9);
    expect(hero.stats.attackIntervalSeconds).toBeLessThan(plain.hero.stats.attackIntervalSeconds);
  });

  it("hunters focus raises attack damage", () => {
    const data = quietData();
    const p = auraParams(data, "hunters-focus");
    const plain = abilityRun("nightglaive", {}, data);
    const run = abilityRun("nightglaive", { 1: 1 }, data);
    expect(run.hero.bonus.damage).toBe(p.damageBonus[0]);
    expect(run.hero.stats.damageMin).toBeCloseTo(plain.hero.stats.damageMin * (1 + p.damageBonus[0]), 9);
    expect(run.hero.stats.damageMax).toBeCloseTo(plain.hero.stats.damageMax * (1 + p.damageBonus[0]), 9);
  });

  it("sums every learned aura and is zero without one", () => {
    const run = abilityRun("nightglaive", { 1: 1, 2: 1 });
    expect(run.hero.bonus.damage).toBeGreaterThan(0);
    expect(run.hero.bonus.moveSpeed).toBeGreaterThan(0);
    const none = abilityRun("nightglaive", {});
    expect(none.hero.bonus).toEqual({ damage: 0, moveSpeed: 0, attackSpeed: 0 });
  });

  it("an aura card refreshes the stats", () => {
    const data = quietData();
    const p = auraParams(data, "hunters-focus");
    const run = abilityRun("nightglaive", { 1: 1 }, data);
    const before = run.hero.stats.damageMax;
    run.hero.pendingLevelUps = 1;
    run.offer = { cards: [{ kind: "ability", slot: 1, fromLevel: 1, toLevel: 2 }] };
    run.state = "levelUp";
    run.step({ ...NO_INPUT, card: 0 });
    expect(run.state).toBe("playing");
    expect(run.hero.bonus.damage).toBe(p.damageBonus[1]);
    expect(run.hero.stats.damageMax).toBeCloseTo(before * (1 + p.damageBonus[1]) / (1 + p.damageBonus[0]), 9);
  });

  it("a level-up keeps the aura bonus in the refreshed stats", () => {
    const data = quietData();
    const p = auraParams(data, "hunters-focus");
    const run = abilityRun("nightglaive", { 1: 1 }, data);
    gainXp(run, 1e9);
    const { constants: c } = data;
    const primary = run.hero.def.primary === "str" ? run.hero.str : run.hero.def.primary === "agi" ? run.hero.agi : run.hero.int;
    expect(run.hero.stats.damageMax).toBeCloseTo(
      (run.hero.def.baseAttack.damageMax + primary * c.primaryAttackBonus) * (1 + p.damageBonus[0]), 9);
  });
});
