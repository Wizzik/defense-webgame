import { describe, expect, it } from "vitest";
import { emptySave, equip, grantNamed, rolledRecord, type SaveData } from "../../meta";
import { Rng, rollItem } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { compareTarget, gridEntries, gridList, itemPower, itemRole } from "./collection-grid";

const data = gameData();
const rings = data.items.filter((i) => i.slotType === "ring");

/** A save owning named items at levels, with uids 1, 2, ... in this order. */
function owning(items: [string, number][]): SaveData {
  return items.reduce((save, [id, level]) => grantNamed(save, data, id, level), emptySave());
}

describe("collection grid", () => {
  it("lists every item, owned or not, the highest rarity first and then in the order of the data", () => {
    const entries = gridEntries(data, emptySave(), "stonehorn", "all");
    expect(entries).toHaveLength(data.items.length);
    expect(entries.every((entry) => !entry.owned && entry.level === 0 && !entry.equipped)).toBe(true);
    const rank = ["mythic", "legendary", "epic", "rare", "common"];
    const ranks = entries.map((entry) => rank.indexOf(entry.item.rarity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const mythics = entries.filter((entry) => entry.item.rarity === "mythic").map((entry) => entry.item.id);
    expect(mythics).toEqual(data.items.filter((i) => i.rarity === "mythic").map((i) => i.id));
  });

  it("a filter keeps one slot type", () => {
    const entries = gridEntries(data, emptySave(), "stonehorn", "ring");
    expect(entries.map((entry) => entry.item.id).sort()).toEqual(rings.map((i) => i.id).sort());
  });

  it("marks what is owned, its level and what this hero wears", () => {
    let save = owning([[rings[0]!.id, 3], [rings[1]!.id, 1]]);
    save = equip(save, data, "stonehorn", 1);
    const of = (hero: string, id: string) => gridEntries(data, save, hero, "ring").find((entry) => entry.item.id === id)!;
    expect(of("stonehorn", rings[0]!.id)).toMatchObject({ uid: 1, owned: true, level: 3, equipped: true, rolled: false });
    expect(of("stonehorn", rings[1]!.id)).toMatchObject({ uid: 2, owned: true, level: 1, equipped: false });
    expect(of("sparkshot", rings[0]!.id)).toMatchObject({ owned: true, level: 3, equipped: false });
    expect(of("stonehorn", rings[2]!.id)).toMatchObject({ uid: 0, owned: false, level: 0, equipped: false });
  });

  it("lists the rolled items after the named ones, the highest rarity first, then in the order they came", () => {
    let save = emptySave();
    const rarities = ["rare", "mythic", "rare", "epic"] as const;
    for (const [i, rarity] of rarities.entries()) {
      const rolled = rollItem(data, new Rng(i + 1), "ring", rarity, 4, "agi");
      save = { ...save, items: [...save.items, rolledRecord(data, save.nextUid, rolled, 2)], nextUid: save.nextUid + 1 };
    }
    save = equip(save, data, "stonehorn", 4);
    const entries = gridEntries(data, save, "stonehorn", "ring");
    expect(entries.slice(0, rings.length).every((entry) => !entry.rolled)).toBe(true);
    const rolled = entries.slice(rings.length);
    expect(rolled.map((entry) => entry.uid)).toEqual([2, 4, 1, 3]);
    expect(rolled.every((entry) => entry.rolled && entry.owned && entry.level === 2)).toBe(true);
    expect(rolled.map((entry) => entry.equipped)).toEqual([false, true, false, false]);
    expect(gridEntries(data, save, "stonehorn", "head").some((entry) => entry.rolled)).toBe(false);
  });

  it("compares with the item the new one would replace", () => {
    let save = owning([[rings[0]!.id, 3], [rings[1]!.id, 2], [rings[2]!.id, 1]]);
    expect(compareTarget(data, save, "stonehorn", rings[0]!, 1)).toBeUndefined();
    save = equip(save, data, "stonehorn", 1);
    // the second ring slot is free
    expect(compareTarget(data, save, "stonehorn", rings[1]!, 2)).toBeUndefined();
    save = equip(save, data, "stonehorn", 2);
    expect(compareTarget(data, save, "stonehorn", rings[2]!, 3)).toEqual({ item: rings[0], level: 3 });
    // an item that is worn is not compared with itself
    expect(compareTarget(data, save, "stonehorn", rings[1]!, 2)).toBeUndefined();
  });

  describe("filters, sort and limit", () => {
    /** A save with `n` rolled items of mixed slots, rarities and roles (uids 1..n). */
    function rolledSave(n: number): SaveData {
      let save = emptySave();
      const types = ["ring", "head", "chest"] as const;
      const rarities = ["common", "rare", "epic", "legendary", "mythic"] as const;
      const roles = ["str", "agi", "int"] as const;
      for (let i = 0; i < n; i++) {
        const rolled = rollItem(data, new Rng(i + 1), types[i % 3]!, rarities[i % 5]!, 1 + (i % 9), roles[i % 3]!);
        save = { ...save, items: [...save.items, rolledRecord(data, save.nextUid, rolled, 1 + (i % 5))], nextUid: save.nextUid + 1 };
      }
      return save;
    }

    it("filters by rarity and by role (a random item's base flavour, a named item's primary attribute)", () => {
      const save = rolledSave(30);
      const mythic = gridEntries(data, save, "stonehorn", "all", { rarity: "mythic" });
      expect(mythic.length).toBeGreaterThan(0);
      expect(mythic.every((entry) => entry.item.rarity === "mythic")).toBe(true);
      for (const role of ["str", "agi", "int", "any"] as const) {
        const entries = gridEntries(data, save, "stonehorn", "all", { role });
        expect(entries.every((entry) => entry.role === role && itemRole(data, entry.item) === role)).toBe(true);
      }
      const rolled = gridEntries(data, save, "stonehorn", "all").filter((entry) => entry.rolled);
      for (const entry of rolled) {
        const base = data.loot.bases.find((b) => `rolled-${b.id}` === entry.item.id)!;
        expect(entry.role).toBe(base.flavour);
      }
      const str = data.items.find((i) => i.stats.some((r) => r.stat === "str") && !i.stats.some((r) => r.stat === "agi" || r.stat === "int"))!;
      expect(itemRole(data, str)).toBe("str");
    });

    it("sorts by power: owned first, then the strongest, the level counted", () => {
      const save = rolledSave(20);
      const entries = gridEntries(data, save, "stonehorn", "all", { sort: "power" });
      const owned = entries.filter((entry) => entry.owned);
      expect(entries.slice(0, owned.length)).toEqual(owned);
      for (let i = 1; i < owned.length; i++) expect(owned[i - 1]!.power).toBeGreaterThanOrEqual(owned[i]!.power);
      const item = owned[0]!.item;
      expect(itemPower(data, item, 3)).toBeGreaterThan(itemPower(data, item, 1));
    });

    it("draws at most the collection limit and counts the rest", () => {
      const tight = gameData();
      tight.rules.loot.collectionLimit = 25;
      const list = gridList(tight, rolledSave(10), "stonehorn", "all");
      expect(list.entries).toHaveLength(25);
      expect(list.total).toBe(tight.items.length + 10);
    });

    it("an owned item nobody wears is salvageable, named too (2026-11-28); a worn or unowned one is not", () => {
      let save = rolledSave(3);
      save = equip(save, data, "sparkshot", 2);
      save = grantNamed(save, data, "skysplitter", 2);
      const entries = gridEntries(data, save, "stonehorn", "all");
      const of = (uid: number) => entries.find((entry) => entry.uid === uid)!;
      expect(of(1).salvageable).toBe(true);
      expect(of(2).salvageable).toBe(false);
      expect(entries.find((entry) => entry.item.id === "skysplitter")!.salvageable).toBe(true);
      expect(entries.filter((entry) => !entry.owned).every((entry) => !entry.salvageable)).toBe(true);
    });
  });
});
