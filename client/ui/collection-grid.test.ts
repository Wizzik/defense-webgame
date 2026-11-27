import { describe, expect, it } from "vitest";
import { emptySave, equip, grantNamed, rolledRecord, type SaveData } from "../../meta";
import { Rng, rollItem } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { compareTarget, gridEntries } from "./collection-grid";

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
    const epics = entries.filter((entry) => entry.item.rarity === "epic").map((entry) => entry.item.id);
    expect(epics).toEqual(data.items.filter((i) => i.rarity === "epic").map((i) => i.id));
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
});
