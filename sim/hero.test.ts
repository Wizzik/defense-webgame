import { describe, expect, it } from "vitest";
import { heroStats } from "./hero";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

describe("heroStats", () => {
  it("matches the map formulas", () => {
    const data = gameData();
    data.rules.hero = {
      collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01,
    };
    const run = createRun(data, { seed: 1 });
    const s = heroStats(data, run.hero, { ...run.hero.stats });
    expect(s.maxHp).toBeCloseTo(1325, 6);
    expect(s.regenPerSecond).toBeCloseTo(2, 6);
    expect(s.armor).toBeCloseTo(7, 6);
    expect(s.attackIntervalSeconds).toBeCloseTo(1.5 / 1.04, 6);
    expect(s.damageMin).toBeCloseTo(37, 6);
    expect(s.damageMax).toBeCloseTo(47, 6);
    expect(s.spellPower).toBeCloseTo(1.24, 6);
    expect(s.cooldownScale).toBeCloseTo(1 / 1.24, 6);
    expect(s.moveSpeed).toBeCloseTo(300, 6);
    expect(s.collision).toBeCloseTo(32, 6);
  });
});
