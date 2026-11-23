import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { formatCoop, formatCoopGroup, formatCoopTotal, heroGroups, playCoop } from "./coop";
import { parseArgs } from "./run";

describe("sim:run --players", () => {
  it("parses one count or a range", () => {
    expect(parseArgs([]).players).toEqual([1]);
    expect(parseArgs(["--players", "3"]).players).toEqual([3]);
    expect(parseArgs(["--players", "2-4"]).players).toEqual([2, 3, 4]);
    expect(() => parseArgs(["--players", "5"])).toThrow(/1 to 4/);
    expect(() => parseArgs(["--players", "3-2"])).toThrow(/1 to 4/);
    expect(parseArgs(["--quiet"]).quiet).toBe(true);
  });

  it("builds one group per hero, wrapping around", () => {
    expect(heroGroups(["a", "b", "c"], 2)).toEqual([["a", "b"], ["b", "c"], ["c", "a"]]);
    expect(heroGroups(["a", "b"], 1)).toEqual([["a"], ["b"]]);
  });

  it("plays a short co-op run with every hero on the autopilot", () => {
    const s = playCoop(gameData(), 1, ["stonehorn", "sparkshot"], [[], []], 1, "normal", 20);
    expect(s.heroes).toEqual(["stonehorn", "sparkshot"]);
    expect(s.downs).toHaveLength(2);
    expect(s.seconds).toBeGreaterThan(0);
    expect(formatCoop(s)).toMatch(/^stonehorn \+ sparkshot seed 1: /);
    expect(formatCoopGroup([s])).toMatch(/1 runs: /);
    expect(formatCoopTotal(2, [s])).toMatch(/^players 2: 1 runs: /);
  }, 60_000);
});
