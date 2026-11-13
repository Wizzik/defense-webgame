import { describe, expect, it } from "vitest";
import { GearState } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { chestLines } from "./chest-lines";

function setup() {
  const data = gameData();
  data.items.push({
    id: "test-helm", name: { en: "Test Helm", cs: "Zkušební přilba" }, slotType: "head", rarity: "rare",
    stats: [{ stat: "str", value: 14 }, { stat: "hp", value: 120 }],
  });
  return { data, gear: new GearState(), helm: data.items.length - 1 };
}

describe("chest lines", () => {
  it("an empty slot shows the common item of its type at level 1", () => {
    const { data, gear } = setup();
    const feet = 9;
    const boots = data.items.find((i) => i.slotType === "feet" && i.rarity === "common")!;
    expect(chestLines("en", data, gear, feet)).toEqual({
      title: boots.name.en, slot: "Feet", rarity: "common", from: 0, to: 1, lines: ["+6 % move speed"],
    });
    expect(chestLines("cs", data, gear, feet)).toEqual({
      title: boots.name.cs, slot: "Boty", rarity: "common", from: 0, to: 1, lines: ["+6 % rychlost pohybu"],
    });
  });

  it("a worn slot shows the old and the new numbers", () => {
    const { data, gear, helm } = setup();
    gear.item[0] = helm;
    gear.base[0] = 1;
    expect(chestLines("en", data, gear, 0)).toEqual({
      title: "Test Helm", slot: "Head", rarity: "rare", from: 1, to: 2,
      lines: ["+14 → +16.1 Strength", "+120 → +138 HP"],
    });
    gear.temp[0] = 1;
    expect(chestLines("cs", data, gear, 0)).toEqual({
      title: "Zkušební přilba", slot: "Hlava", rarity: "rare", from: 2, to: 3,
      lines: ["+16.1 → +18.2 síla", "+138 → +156 HP"],
    });
  });
});
