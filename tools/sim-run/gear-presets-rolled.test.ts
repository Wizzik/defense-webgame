import { describe, expect, it } from "vitest";
import { RARITIES } from "../../data/schema";
import { SLOT_IDS } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { gearPreset } from "./gear-presets";

describe("rolled gear presets (random items stage 5)", () => {
  const data = gameData();

  it("rolled-mid is a rare item of level 1 in every slot, the same for the same seed", () => {
    const a = gearPreset(data, "stonehorn", "rolled-mid", 3);
    expect(a.map((e) => e.slot)).toEqual([...SLOT_IDS]);
    expect(a.every((e) => e.rolled?.rarity === RARITIES.indexOf("rare") && e.level === 1)).toBe(true);
    expect(JSON.stringify(gearPreset(data, "stonehorn", "rolled-mid", 3))).toBe(JSON.stringify(a));
    expect(JSON.stringify(gearPreset(data, "stonehorn", "rolled-mid", 4))).not.toBe(JSON.stringify(a));
  });

  it("rolled-full is a mythic item at the top level in every slot", () => {
    const full = gearPreset(data, "sparkshot", "rolled-full");
    expect(full).toHaveLength(SLOT_IDS.length);
    expect(full.every((e) => e.rolled?.rarity === RARITIES.indexOf("mythic") && e.level === data.rules.gear.maxPermanentLevel)).toBe(true);
  });
});
