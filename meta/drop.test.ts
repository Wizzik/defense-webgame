import { describe, expect, it } from "vitest";
import type { GameData, Rarity } from "../data/schema";
import { gameData } from "../sim/testing/game-data";
import { applyDrop, type Drop, rollDrop } from "./drop";
import { namedRecord } from "./item-record";
import { emptySave, type SaveData } from "./save";

const data: GameData = gameData();
const MAX = data.rules.gear.maxPermanentLevel;

function owning(filter: (rarity: Rarity) => boolean, level = 1): SaveData {
  const save = emptySave();
  for (const item of data.items) {
    if (!filter(item.rarity)) continue;
    save.items.push(namedRecord(data, save.nextUid, item.id, level)!);
    save.nextUid++;
  }
  return save;
}

const rarityOf = (drop: Drop): Rarity | null => (drop.kind === "none" ? null : drop.item.rarity);

describe("boss drops", () => {
  /** Share of drops of `rarities` over seeds 1..n with an empty collection and the given magic find. */
  const shareOf = (boss: string, rarities: string[], magicFind: number, n = 2000) => {
    let hits = 0;
    for (let seed = 1; seed <= n; seed++) {
      const rarity = rarityOf(rollDrop(data, emptySave(), boss, seed, 0, magicFind));
      if (rarity && rarities.includes(rarity)) hits++;
    }
    return hits / n;
  };

  it("magic find makes the higher rarities of a boss more likely", () => {
    const before = shareOf("dread-regent", ["legendary", "mythic"], 0); // 50 / 100
    const after = shareOf("dread-regent", ["legendary", "mythic"], 1); // 113 / 163
    expect(before).toBeGreaterThan(0.45);
    expect(before).toBeLessThan(0.55);
    expect(after).toBeGreaterThan(0.64);
    expect(after).toBeLessThan(0.74);
  });

  it("the lowest rarity of the table keeps its weight", () => {
    const common = shareOf("iron-marshal", ["common"], 1); // 60 / (60 + 64)
    expect(common).toBeGreaterThan(0.44);
    expect(common).toBeLessThan(0.53);
  });

  it("a magic find of 0 draws exactly as the call without it", () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect(rollDrop(data, emptySave(), "gunmaster", seed, 1, 0)).toEqual(rollDrop(data, emptySave(), "gunmaster", seed, 1));
    }
  });

  it("common and rare drops are always rolled items (their named share is 0)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const drop = rollDrop(data, emptySave(), "iron-marshal", seed, 0);
      expect(drop.kind).toBe("rolled");
      if (drop.kind !== "rolled") continue;
      expect(["common", "rare"]).toContain(drop.item.rarity);
      expect(drop.record.base).toBeDefined();
      expect(drop.record.named).toBeUndefined();
      expect(drop.record.rarity).toBe(drop.item.rarity);
    }
  });

  it("a drop is a named item about as often as the rarity's named share", () => {
    const counts: Record<string, { named: number; all: number }> = {};
    for (let seed = 1; seed <= 4000; seed++) {
      const drop = rollDrop(data, emptySave(), "dread-regent", seed, 3);
      if (drop.kind === "none") throw new Error("expected a drop");
      const row = (counts[drop.item.rarity] ??= { named: 0, all: 0 });
      row.all++;
      if (drop.kind === "new") row.named++;
    }
    for (const rarity of ["epic", "legendary"] as const) {
      const share = counts[rarity]!.named / counts[rarity]!.all;
      expect(share).toBeGreaterThan(data.rules.loot.namedShare[rarity] - 0.05);
      expect(share).toBeLessThan(data.rules.loot.namedShare[rarity] + 0.05);
    }
  });

  it("a named drop of an owned item below the top level raises its level", () => {
    const save = owning((rarity) => rarity !== "common" && rarity !== "rare", 2);
    let levels = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const drop = rollDrop(data, save, "dread-regent", seed, 3);
      expect(drop.kind).not.toBe("new");
      if (drop.kind !== "level") continue;
      levels++;
      expect(drop.level).toBe(3);
      expect(save.items.some((record) => record.uid === drop.uid && record.named === drop.item.id)).toBe(true);
    }
    expect(levels).toBeGreaterThan(0);
  });

  it("with every named item of the rarity at the top level, the drop is a rolled item", () => {
    const save = owning(() => true, MAX);
    for (let seed = 1; seed <= 200; seed++) {
      expect(rollDrop(data, save, "dread-regent", seed, 3).kind).toBe("rolled");
    }
  });

  it("the rolled level follows the boss's item power: order, world and difficulty", () => {
    const levelOf = (order: number, world: number, difficulty: "normal" | "insane" | "hell") => {
      const drop = rollDrop(data, emptySave(), "iron-marshal", 9, order, 0, { world, difficulty, primary: "str" });
      if (drop.kind !== "rolled") throw new Error("expected a rolled drop");
      expect(drop.record.level).toBe(drop.level);
      return drop.level;
    };
    expect(levelOf(0, 1, "normal")).toBe(1); // power 2
    expect(levelOf(1, 1, "normal")).toBe(2); // power 4
    expect(levelOf(3, 1, "normal")).toBe(3); // power 8
    expect(levelOf(3, 5, "hell")).toBe(5); // power 8 + 2 + 2
  });

  it("smart loot leans the rolled bases to the hero's primary attribute", () => {
    const flavourShare = (primary: "str" | "int") => {
      let hits = 0;
      let all = 0;
      for (let seed = 1; seed <= 600; seed++) {
        const drop = rollDrop(data, emptySave(), "iron-marshal", seed, 0, 0, { primary });
        if (drop.kind !== "rolled") continue;
        const base = data.loot.bases.find((candidate) => candidate.id === drop.record.base)!;
        all++;
        if (base.flavour === primary) hits++;
      }
      return hits / all;
    };
    // any base of the slot type would match about one time in three
    expect(flavourShare("str")).toBeGreaterThan(0.55);
    expect(flavourShare("int")).toBeGreaterThan(0.55);
  });

  it("an enemy without a drop table drops nothing", () => {
    expect(rollDrop(data, emptySave(), "captain", 1, 0)).toEqual({ kind: "none" });
    expect(rollDrop(data, emptySave(), "nobody", 1, 0)).toEqual({ kind: "none" });
  });

  it("the same seed, order and course give the same drop; another order may give another", () => {
    const names = new Set<string>();
    for (let order = 0; order < 8; order++) {
      const a = rollDrop(data, emptySave(), "pale-abbot", 77, order, 0, { world: 2, difficulty: "insane", primary: "agi" });
      const b = rollDrop(data, emptySave(), "pale-abbot", 77, order, 0, { world: 2, difficulty: "insane", primary: "agi" });
      expect(a).toEqual(b);
      if (a.kind !== "none") names.add(a.item.name.en);
    }
    expect(names.size).toBeGreaterThan(1);
  });

  it("the final boss drops a mythic item about one time in ten", () => {
    let mythic = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      if (rarityOf(rollDrop(data, emptySave(), "dread-regent", seed, 3)) === "mythic") mythic++;
    }
    expect(mythic / 2000).toBeGreaterThan(0.07);
    expect(mythic / 2000).toBeLessThan(0.13);
  });

  it("applyDrop adds a new record with the save's next uid or raises a level, and leaves its input alone", () => {
    const save = emptySave();
    const first = rollDrop(data, save, "iron-marshal", 5, 0);
    if (first.kind !== "rolled") throw new Error("expected a rolled drop");
    const after = applyDrop(save, first);
    expect(save.items).toEqual([]);
    expect(save.nextUid).toBe(1);
    expect(after.items).toEqual([{ ...first.record, uid: 1 }]);
    expect(after.nextUid).toBe(2);

    const again = applyDrop(after, { ...first, record: { ...first.record, uid: 1 } });
    expect(again.items.map((record) => record.uid)).toEqual([1, 2]);

    const item = data.items[0]!;
    const named = applyDrop(again, { kind: "new", item, level: 1, record: namedRecord(data, 99, item.id, 1)! });
    expect(named.items[2]).toEqual({ uid: 3, rarity: item.rarity, level: 1, named: item.id });
    const raised = applyDrop(named, { kind: "level", item, level: 2, uid: 3 });
    expect(raised.items[2]!.level).toBe(2);
    expect(named.items[2]!.level).toBe(1);
    expect(applyDrop(raised, { kind: "none" })).toEqual(raised);
  });
});
