import { describe, expect, it } from "vitest";
import type { GameData } from "../data/schema";
import { gameData } from "../sim/testing/game-data";
import { applyDrop, rollDrop } from "./drop";
import { emptySave, type SaveData } from "./save";

const data: GameData = gameData();
const MAX = data.rules.gear.maxPermanentLevel;

function owning(filter: (rarity: string) => boolean, level = 1): SaveData {
  const save = emptySave();
  for (const item of data.items) if (filter(item.rarity)) save.items[item.id] = level;
  return save;
}

describe("boss drops", () => {
  it("an empty collection always gets a new item of a rarity of the boss's table", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const drop = rollDrop(data, emptySave(), "iron-marshal", seed, 0);
      expect(drop.kind).toBe("new");
      if (drop.kind !== "new") continue;
      expect(drop.level).toBe(1);
      expect(["common", "rare"]).toContain(drop.item.rarity);
    }
  });

  it("with every item of the drawn rarity owned, one under the top level gains a level", () => {
    const save = owning((rarity) => rarity === "common" || rarity === "rare", 2);
    for (let seed = 1; seed <= 50; seed++) {
      const drop = rollDrop(data, save, "iron-marshal", seed, 0);
      expect(drop.kind).toBe("level");
      if (drop.kind === "level") expect(drop.level).toBe(3);
    }
  });

  it("with the drawn rarity all at the top level, another rarity of the boss is tried", () => {
    const save = owning((rarity) => rarity === "common", MAX);
    for (let seed = 1; seed <= 50; seed++) {
      const drop = rollDrop(data, save, "iron-marshal", seed, 0);
      expect(drop.kind).toBe("new");
      if (drop.kind === "new") expect(drop.item.rarity).toBe("rare");
    }
    const rares = owning((rarity) => rarity === "rare", MAX);
    for (let seed = 1; seed <= 50; seed++) {
      const drop = rollDrop(data, rares, "iron-marshal", seed, 0);
      expect(drop.kind).toBe("new");
      if (drop.kind === "new") expect(drop.item.rarity).toBe("common");
    }
  });

  it("a collection with everything at the top level gets nothing", () => {
    const save = owning(() => true, MAX);
    for (const boss of ["iron-marshal", "pale-abbot", "gunmaster", "dread-regent"]) {
      expect(rollDrop(data, save, boss, 1, 0)).toEqual({ kind: "none" });
    }
  });

  it("an enemy without a drop table drops nothing", () => {
    expect(rollDrop(data, emptySave(), "captain", 1, 0)).toEqual({ kind: "none" });
    expect(rollDrop(data, emptySave(), "nobody", 1, 0)).toEqual({ kind: "none" });
  });

  it("the same seed and order give the same drop; another order may give another", () => {
    const ids = new Set<string>();
    for (let order = 0; order < 8; order++) {
      const a = rollDrop(data, emptySave(), "pale-abbot", 77, order);
      const b = rollDrop(data, emptySave(), "pale-abbot", 77, order);
      expect(a).toEqual(b);
      if (a.kind !== "none") ids.add(a.item.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it("the final boss drops a mythic item about one time in ten", () => {
    let mythic = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const drop = rollDrop(data, emptySave(), "dread-regent", seed, 3);
      if (drop.kind !== "none" && drop.item.rarity === "mythic") mythic++;
    }
    expect(mythic / 2000).toBeGreaterThan(0.07);
    expect(mythic / 2000).toBeLessThan(0.13);
  });

  it("applyDrop adds a new item at level 1 or raises the level, and leaves its input alone", () => {
    const save = emptySave();
    const first = rollDrop(data, save, "iron-marshal", 5, 0);
    if (first.kind === "none") throw new Error("expected a drop");
    const after = applyDrop(save, first);
    expect(save.items).toEqual({});
    expect(after.items).toEqual({ [first.item.id]: 1 });
    const raised = applyDrop(after, { kind: "level", item: first.item, level: 2 });
    expect(raised.items[first.item.id]).toBe(2);
    expect(after.items[first.item.id]).toBe(1);
    expect(applyDrop(after, { kind: "none" })).toEqual(after);
  });
});
