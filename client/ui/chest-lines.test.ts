import { describe, expect, it } from "vitest";
import { ChestAction, GearState } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { chestLines } from "./chest-lines";
import { itemLines } from "./item-lines";
import { tooltipLines } from "./item-tooltip";

function setup() {
  const data = gameData();
  data.rules.gear.chestLevelStep = 0.3; // the numbers below are worked out with this step
  data.items.push({
    id: "test-helm", name: { en: "Test Helm", cs: "Zkušební přilba" }, slotType: "head", rarity: "rare",
    stats: [{ stat: "str", value: 14 }, { stat: "hp", value: 120 }],
  });
  // named items are legendary and mythic since 2026-11-28: plain test items of the lower rarities
  data.items.push(
    {
      id: "test-crown", name: { en: "Test Crown", cs: "Zkušební koruna" }, slotType: "head", rarity: "epic",
      stats: [{ stat: "str", value: 20 }, { stat: "hp", value: 150 }, { stat: "armor", value: 2 }],
    },
    {
      id: "test-boots", name: { en: "Test Boots", cs: "Zkušební boty" }, slotType: "feet", rarity: "common",
      stats: [{ stat: "moveSpeed", value: 0.06 }],
    },
  );
  const epic = data.items.findIndex((i) => i.id === "test-crown");
  return { data, gear: new GearState(), helm: data.items.findIndex((i) => i.id === "test-helm"), epic };
}

describe("chest lines", () => {
  it("a new item shows its stats at level 1 and 'new for this run'", () => {
    const { data, gear } = setup();
    const feet = 9;
    const boots = data.items.findIndex((i) => i.id === "test-boots");
    const card = { slot: feet, item: boots, action: ChestAction.New };
    expect(chestLines("en", data, gear, card)).toEqual({
      title: data.items[boots]!.name.en, slot: "Feet", slotType: "feet", itemId: data.items[boots]!.id, rarity: "common", rarityName: "Common",
      action: "new for this run",
      lines: itemLines("en", data.items[boots]!, 0, 1, data.rules.gear).map((text, r) => ({ text, tone: "plain", stat: data.items[boots]!.stats[r]!.stat })),
    });
    expect(chestLines("cs", data, gear, card).action).toBe("nové na tento běh");
  });

  it("a new legendary names its effect", () => {
    const { data, gear } = setup();
    const sword = data.items.findIndex((i) => i.id === "skysplitter");
    const info = chestLines("en", data, gear, { slot: 14, item: sword, action: ChestAction.New });
    expect(info.lines.at(-1)).toEqual({ text: data.items[sword]!.effect!.text.en, tone: "effect" });
  });

  it("a choice compares with the worn item and names it", () => {
    const { data, gear, helm, epic } = setup();
    gear.item[0] = helm;
    gear.base[0] = 2;
    gear.temp[0] = 1;
    const info = chestLines("cs", data, gear, { slot: 0, item: epic, action: ChestAction.Choice });
    expect(info.title).toBe(data.items[epic]!.name.cs);
    expect(info.rarity).toBe("epic");
    expect(info.action).toBe("porovnat s nasazeným: Zkušební přilba");
    expect(info.lines).toEqual(
      tooltipLines("cs", data, data.items[epic]!, 0, 4, { item: data.items[helm]!, level: 2, temp: 1 }).lines,
    );
    expect(info.lines.some((line) => line.tone === "better" || line.tone === "worse")).toBe(true);
  });

  it("a level card shows the worn item from → to", () => {
    const { data, gear, helm } = setup();
    gear.item[0] = helm;
    gear.base[0] = 2;
    gear.temp[0] = 1;
    const info = chestLines("cs", data, gear, { slot: 0, item: helm, action: ChestAction.Level });
    expect(info.title).toBe("Zkušební přilba");
    expect(info.action).toBe("úroveň 3 → 4");
    expect(info.lines).toEqual([
      { text: "+20.3 → +24.5 síla", tone: "better", stat: "str" },
      { text: "+174 → +210 HP", tone: "better", stat: "hp" },
    ]);
  });

  it("the rarity name and the slot type travel with the card", () => {
    const { data, gear, epic } = setup();
    const info = chestLines("cs", data, gear, { slot: 0, item: epic, action: ChestAction.New });
    expect(info.rarityName).toBe("Epický");
    expect(info.slotType).toBe("head");
    expect(info.slot).toBe("Hlava");
  });
});
