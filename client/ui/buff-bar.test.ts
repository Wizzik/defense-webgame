import { describe, expect, it } from "vitest";
import { BuffState } from "../../sim";
import { buffCells } from "./buff-bar";

describe("buff bar", () => {
  it("lists only the running effects, in the order boots, berserk, heal", () => {
    const buffs = new BuffState();
    expect(buffCells(buffs, "en")).toEqual([]);
    buffs.healTicks = 30;
    buffs.bootsTicks = 450;
    expect(buffCells(buffs, "en").map((c) => c.kind)).toEqual(["boots", "heal"]);
  });

  it("rounds the seconds up", () => {
    const buffs = new BuffState();
    buffs.berserkTicks = 31;
    expect(buffCells(buffs, "en")[0]!.seconds).toBe(2);
    buffs.berserkTicks = 30;
    expect(buffCells(buffs, "en")[0]!.seconds).toBe(1);
    buffs.berserkTicks = 1;
    expect(buffCells(buffs, "en")[0]!.seconds).toBe(1);
  });

  it("names the effects in both languages", () => {
    const buffs = new BuffState();
    buffs.bootsTicks = 1;
    buffs.berserkTicks = 1;
    buffs.healTicks = 1;
    expect(buffCells(buffs, "en").map((c) => c.label)).toEqual(["Boots of Haste", "Berserk", "Renewal"]);
    expect(buffCells(buffs, "cs").map((c) => c.label)).toEqual(["Boty rychlosti", "Berserk", "Obnova"]);
  });
});
