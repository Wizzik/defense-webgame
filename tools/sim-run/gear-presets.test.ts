import { describe, expect, it } from "vitest";
import { createRun, SLOT_IDS } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { gearPreset } from "./gear-presets";
import { parseArgs } from "./run";

const data = gameData();

describe("gear presets", () => {
  it("none is empty", () => {
    expect(gearPreset(data, "stonehorn", "none")).toEqual([]);
  });

  it("mid and full fill all 16 slots with entries a run accepts", () => {
    for (const hero of data.heroes) {
      for (const preset of ["mid", "full"] as const) {
        const loadout = gearPreset(data, hero.id, preset);
        expect(loadout.map((entry) => entry.slot), `${hero.id} ${preset}`).toEqual([...SLOT_IDS]);
        expect(new Set(loadout.map((entry) => entry.item)).size).toBe(16);
        const run = createRun(data, { seed: 1, hero: hero.id, loadout });
        expect(Array.from(run.gear.item).every((index) => index >= 0), `${hero.id} ${preset}`).toBe(true);
        const level = preset === "mid" ? 1 : data.rules.gear.maxPermanentLevel;
        expect(Array.from(run.gear.base)).toEqual(new Array(16).fill(level));
      }
    }
  });

  it("mid is rare items that lean to the hero's main attribute where one exists", () => {
    for (const hero of data.heroes) {
      const items = gearPreset(data, hero.id, "mid").map((entry) => data.items.find((item) => item.id === entry.item)!);
      expect(items.every((item) => item.rarity === "rare")).toBe(true);
      for (const item of items) {
        const leaning = data.items.some((other) =>
          other.rarity === "rare" && other.slotType === item.slotType && other.stats.some((row) => row.stat === hero.primary));
        // the second ring or trinket may have to take what is left
        if (leaning && item.slotType !== "ring" && item.slotType !== "trinket") {
          expect(item.stats.some((row) => row.stat === hero.primary), `${hero.id}: ${item.id}`).toBe(true);
        }
      }
    }
  });

  it("full wears every mythic item and the highest rarity of every other slot", () => {
    const ids = gearPreset(data, "sparkshot", "full").map((entry) => entry.item);
    for (const item of data.items.filter((candidate) => candidate.rarity === "mythic")) expect(ids).toContain(item.id);
    const rarities = ids.map((id) => data.items.find((item) => item.id === id)!.rarity);
    expect(rarities.filter((rarity) => rarity === "mythic")).toHaveLength(3);
    expect(rarities.filter((rarity) => rarity === "legendary")).toHaveLength(1);
    expect(rarities.filter((rarity) => rarity === "epic")).toHaveLength(12);
  });

  it("sim:run takes --gear", () => {
    expect(parseArgs([]).gear).toBe("none");
    expect(parseArgs(["--gear", "full", "--seeds", "1-2"]).gear).toBe("full");
    expect(() => parseArgs(["--gear", "best"])).toThrow("--gear needs none, mid or full");
  });
});
