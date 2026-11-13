import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { Announcer } from "./announcer";
import { dropLine } from "./drop-lines";

const item = gameData().items.find((i) => i.id === "oaken-shield")!;

describe("drop lines", () => {
  it("names a new item, a raised level and a full collection", () => {
    expect(dropLine("en", { kind: "new", item, level: 1 })).toEqual({ text: "Loot: Oaken Shield (new)", tone: "rarity-rare" });
    expect(dropLine("cs", { kind: "new", item, level: 1 })).toEqual({ text: "Kořist: Dubový štít (nový)", tone: "rarity-rare" });
    expect(dropLine("en", { kind: "level", item, level: 3 }).text).toBe("Loot: Oaken Shield (level 3)");
    expect(dropLine("cs", { kind: "level", item, level: 3 }).text).toBe("Kořist: Dubový štít (úroveň 3)");
    expect(dropLine("en", { kind: "none" })).toEqual({ text: "This boss has nothing new for you", tone: "" });
    expect(dropLine("cs", { kind: "none" })).toEqual({ text: "Sbírka tohoto bosse je úplná", tone: "" });
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
