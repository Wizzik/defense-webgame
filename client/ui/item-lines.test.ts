import { describe, expect, it } from "vitest";
import type { Item } from "../../data/schema";
import { itemLines, statLabel, statValue } from "./item-lines";

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
    expect(itemLines("en", helm, 1, 0.15)).toEqual(["+14 Strength", "+120 HP"]);
    expect(itemLines("cs", helm, 1, 0.15)).toEqual(["+14 síla", "+120 HP"]);
  });

  it("scales the numbers with the item level", () => {
    expect(itemLines("en", helm, 2, 0.15)).toEqual(["+16.1 Strength", "+138 HP"]);
    expect(itemLines("cs", helm, 2, 0.15)).toEqual(["+16.1 síla", "+138 HP"]);
  });

  it("shows shares as percent and plain numbers as they are", () => {
    expect(itemLines("en", ring, 1, 0.15)).toEqual(["+6 % gold", "+60 pickup range"]);
    expect(itemLines("cs", ring, 2, 0.15)).toEqual(["+6.9 % zlata", "+69 dosah sbírání"]);
  });

  it("names every stat in both languages", () => {
    const stats = ["str", "agi", "int", "hp", "armor", "regen", "damage", "attackSpeed", "moveSpeed", "spellPower", "magnet", "goldFind"] as const;
    for (const stat of stats) {
      expect(statLabel("en", stat).length).toBeGreaterThan(0);
      expect(statLabel("cs", stat).length).toBeGreaterThan(0);
    }
    expect(statValue("armor", 1.5)).toBe("+1.5");
    expect(statValue("moveSpeed", 0.06)).toBe("+6 %");
  });
});
