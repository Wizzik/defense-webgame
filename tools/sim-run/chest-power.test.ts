import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { type ChestPower, chestPower, formatChestPower, parseChestArgs } from "./chest-power";

function row(hp: number, attack: number, spells: number): ChestPower {
  return {
    hp, attack, spells,
    picks: { new: 0, replace: 0, level: 0 },
    rarities: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
  };
}

describe("chest power", () => {
  it("fifteen chests make a bare hero stronger and the measure is deterministic", () => {
    const a = chestPower(gameData(), "stonehorn", 3, { chests: 15, level: 25 });
    expect(a).toEqual(chestPower(gameData(), "stonehorn", 3, { chests: 15, level: 25 }));
    expect(a.hp).toBeGreaterThan(1);
    expect(a.attack).toBeGreaterThan(1);
    expect(a.spells).toBeGreaterThan(1);
    expect(a.picks.new + a.picks.replace + a.picks.level).toBe(15);
    expect(Object.values(a.rarities).reduce((sum, n) => sum + n, 0)).toBe(15);
  });

  it("no chest leaves the hero as it is", () => {
    const a = chestPower(gameData(), "nightglaive", 1, { chests: 0, level: 25 });
    expect([a.hp, a.attack, a.spells]).toEqual([1, 1, 1]);
  });

  it("the summary line gives the averages", () => {
    expect(formatChestPower("stonehorn", [row(1.4, 1.6, 1.5), row(1.6, 1.4, 1.5)]))
      .toContain("stonehorn: hp x1.50, attack x1.50, spells x1.50, mean x1.50");
  });

  it("reads seeds, chests, level and hero from the command line", () => {
    expect(parseChestArgs([])).toEqual({ from: 1, to: 200, chests: 15, level: 25, hero: "all" });
    expect(parseChestArgs(["--seeds", "5-9", "--chests", "10", "--level", "20", "--hero", "sparkshot"]))
      .toEqual({ from: 5, to: 9, chests: 10, level: 20, hero: "sparkshot" });
    expect(() => parseChestArgs(["--seeds", "9-5"])).toThrow();
  });
});
