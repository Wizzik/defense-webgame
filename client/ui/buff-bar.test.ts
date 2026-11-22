import { describe, expect, it } from "vitest";
import { BuffState } from "../../sim";
import { buffCells } from "./buff-bar";

const free = { slowTicks: 0, rootTicks: 0 };

describe("buff bar", () => {
  it("lists only the running effects, in the order boots, berserk, heal", () => {
    const buffs = new BuffState();
    expect(buffCells(buffs, free, "en")).toEqual([]);
    buffs.healTicks = 30;
    buffs.bootsTicks = 450;
    expect(buffCells(buffs, free, "en").map((c) => c.kind)).toEqual(["boots", "heal"]);
  });

  it("rounds the seconds up", () => {
    const buffs = new BuffState();
    buffs.berserkTicks = 31;
    expect(buffCells(buffs, free, "en")[0]!.seconds).toBe(2);
    buffs.berserkTicks = 30;
    expect(buffCells(buffs, free, "en")[0]!.seconds).toBe(1);
    buffs.berserkTicks = 1;
    expect(buffCells(buffs, free, "en")[0]!.seconds).toBe(1);
  });

  it("names the effects in both languages", () => {
    const buffs = new BuffState();
    buffs.bootsTicks = 1;
    buffs.berserkTicks = 1;
    buffs.healTicks = 1;
    expect(buffCells(buffs, free, "en").map((c) => c.label)).toEqual(["Boots of Haste", "Berserk", "Renewal"]);
    expect(buffCells(buffs, free, "cs").map((c) => c.label)).toEqual(["Boty rychlosti", "Berserk", "Obnova"]);
  });

  it("shows the web and the roots with their seconds after the orb effects, in both languages", () => {
    const buffs = new BuffState();
    buffs.bootsTicks = 30;
    const snared = { slowTicks: 45, rootTicks: 36 };
    const cells = buffCells(buffs, snared, "en");
    expect(cells.map((c) => [c.kind, c.seconds])).toEqual([["boots", 1], ["web", 2], ["root", 2]]);
    expect(cells.slice(1).map((c) => c.label)).toEqual(["Webbed", "Rooted"]);
    expect(buffCells(buffs, snared, "cs").slice(1).map((c) => c.label)).toEqual(["V síti", "Spoután"]);
  });

  it("shows the storm with the seconds until the nearest bolt, after the snares", () => {
    const buffs = new BuffState();
    buffs.bootsTicks = 30;
    const cells = buffCells(buffs, { slowTicks: 30, rootTicks: 0 }, "cs", hz({ stormTicks: 36 }));
    expect(cells.map((c) => c.kind)).toEqual(["boots", "web", "storm"]);
    expect(cells[2]!.seconds).toBe(2);
    expect(cells[2]!.label).toBe("Blesk");
    expect(buffCells(buffs, free, "en", hz({ stormTicks: 1 })).at(-1)!.label).toBe("Lightning");
    expect(buffCells(buffs, free, "en", hz({})).map((c) => c.kind)).toEqual(["boots"]);
  });

  it("a running sandstorm shows its seconds", () => {
    const buffs = new BuffState();
    const cells = buffCells(buffs, free, "cs", hz({ sandTicks: 299 }));
    expect(cells.map((c) => [c.kind, c.seconds, c.label])).toEqual([["sand", 10, "Písečná bouře"]]);
    expect(buffCells(buffs, free, "en", hz({ sandTicks: 30 }))[0]!.label).toBe("Sandstorm");
  });

  it("the thicket shows its glyph without seconds only while the hero stands in it", () => {
    const buffs = new BuffState();
    expect(buffCells(buffs, free, "en", hz({ inThicket: false }))).toEqual([]);
    const cells = buffCells(buffs, free, "cs", hz({ inThicket: true }));
    expect(cells.map((c) => [c.kind, c.seconds, c.label])).toEqual([["thicket", 0, "Trnité houští"]]);
  });
});

function hz(over: Partial<{ stormTicks: number; sandTicks: number; inThicket: boolean }>) {
  return { stormTicks: 0, sandTicks: 0, inThicket: false, ...over };
}
