import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { Announcer } from "./announcer";
import { ChestAction } from "../../sim";
import { chestLootLine, dropLine } from "./drop-lines";
import type { ItemRecord } from "../../meta";

const item = gameData().items.find((i) => i.id === "oaken-shield")!;
const record: ItemRecord = { uid: 1, rarity: "legendary", level: 1, named: "oaken-shield" };

describe("drop lines", () => {
  it("names a new item, a raised level and a full collection", () => {
    expect(dropLine("en", { kind: "new", item, level: 1, record })).toEqual({ text: "Loot: Oaken Shield (new)", tone: "rarity-legendary" });
    expect(dropLine("cs", { kind: "new", item, level: 1, record })).toEqual({ text: "Kořist: Dubový štít (nový)", tone: "rarity-legendary" });
    expect(dropLine("en", { kind: "level", item, level: 3, uid: 1 }).text).toBe("Loot: Oaken Shield (level 3)");
    expect(dropLine("cs", { kind: "level", item, level: 3, uid: 1 }).text).toBe("Kořist: Dubový štít (úroveň 3)");
    expect(dropLine("en", { kind: "rolled", item, level: 2, record })).toEqual({ text: "Loot: Oaken Shield (new)", tone: "rarity-legendary" });
    expect(dropLine("en", { kind: "none" })).toEqual({ text: "This boss has nothing new for you", tone: "" });
    expect(dropLine("cs", { kind: "none" })).toEqual({ text: "Sbírka tohoto bosse je úplná", tone: "" });
  });

  it("a legendary or mythic chest pick gets a loot line, other picks none", () => {
    const data = gameData();
    const sword = data.items.findIndex((i) => i.id === "skysplitter");
    const mythic = data.items.findIndex((i) => i.rarity === "mythic");
    const rare = { ...data.items[sword]!, rarity: "rare" as const };
    expect(chestLootLine("en", data.items[sword], ChestAction.New)).toEqual({ text: `Chest: ${data.items[sword]!.name.en}`, tone: "rarity-legendary" });
    expect(chestLootLine("cs", data.items[mythic], ChestAction.Choice)).toEqual({ text: `Truhla: ${data.items[mythic]!.name.cs}`, tone: "rarity-mythic" });
    expect(chestLootLine("en", data.items[sword], ChestAction.Level)).toBeNull();
    expect(chestLootLine("en", rare, ChestAction.New)).toBeNull();
  });

  it("the announcer carries the tone of its line", () => {
    const announcer = new Announcer();
    expect(announcer.tone).toBe("");
    announcer.push("loot", 10, "rarity-epic");
    expect(announcer.tone).toBe("rarity-epic");
    announcer.push("plain", 10);
    expect(announcer.tone).toBe("");
  });
});
