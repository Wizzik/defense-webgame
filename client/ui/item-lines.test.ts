import { describe, expect, it } from "vitest";
import type { Item } from "../../data/schema";
import { itemLines, statLabel, statValue } from "./item-lines";

const GEAR = { levelStep: 0.15, chestLevelStep: 0.3, maxPermanentLevel: 5 };

const helm: Item = {
  id: "test-helm", name: { en: "Test Helm", cs: "Zkušební přilba" }, slotType: "head", rarity: "rare",
  stats: [{ stat: "str", value: 14 }, { stat: "hp", value: 120 }],
};
const ring: Item = {
  id: "test-ring", name: { en: "Test Ring", cs: "Zkušební prsten" }, slotType: "ring", rarity: "rare",
  stats: [{ stat: "goldFind", value: 0.06 }, { stat: "magnet", value: 60 }],
};

describe("item lines", () => {
  it("lists the stat rows of level 1 in English and Czech", () => {
    expect(itemLines("en", helm, 1, 0, GEAR)).toEqual(["+14 Strength", "+120 HP"]);
    expect(itemLines("cs", helm, 1, 0, GEAR)).toEqual(["+14 síla", "+120 HP"]);
  });

  it("scales the numbers with the item level", () => {
    expect(itemLines("en", helm, 2, 0, GEAR)).toEqual(["+16.1 Strength", "+138 HP"]);
    expect(itemLines("cs", helm, 2, 0, GEAR)).toEqual(["+16.1 síla", "+138 HP"]);
  });

  it("an item a chest gave counts its chest levels", () => {
    expect(itemLines("en", helm, 0, 1, GEAR)).toEqual(["+18.2 Strength", "+156 HP"]);
  });

  it("shows shares as percent and plain numbers as they are", () => {
    expect(itemLines("en", ring, 1, 0, GEAR)).toEqual(["+6 % gold", "+60 pickup range"]);
    expect(itemLines("cs", ring, 2, 0, GEAR)).toEqual(["+6.9 % zlata", "+69 dosah sbírání"]);
  });

  it("names every stat in both languages", () => {
    const stats = ["str", "agi", "int", "hp", "armor", "regen", "damage", "attackSpeed", "moveSpeed", "spellPower", "magnet", "goldFind", "magicFind", "lifesteal"] as const;
    for (const stat of stats) {
      expect(statLabel("en", stat).length).toBeGreaterThan(0);
      expect(statLabel("cs", stat).length).toBeGreaterThan(0);
    }
    expect(statValue("armor", 1.5)).toBe("+1.5");
    expect(statValue("moveSpeed", 0.06)).toBe("+6 %");
    expect(statValue("magicFind", 0.12)).toBe("+12 %");
    expect(itemLines("en", { ...ring, stats: [{ stat: "magicFind", value: 0.12 }] }, 1, 0, GEAR)).toEqual(["+12 % magic find"]);
    expect(itemLines("cs", { ...ring, stats: [{ stat: "magicFind", value: 0.12 }] }, 1, 0, GEAR)).toEqual(["+12 % magický nález"]);
    expect(statValue("lifesteal", 0.015)).toBe("+1.5 %");
    expect(itemLines("en", { ...ring, stats: [{ stat: "lifesteal", value: 0.015 }] }, 1, 0, GEAR)).toEqual(["+1.5 % lifesteal"]);
    expect(itemLines("cs", { ...ring, stats: [{ stat: "lifesteal", value: 0.015 }] }, 1, 0, GEAR)).toEqual(["+1.5 % vysávání života"]);
  });
});
