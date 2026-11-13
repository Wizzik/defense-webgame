import { describe, expect, it } from "vitest";
import { emptySave, equip } from "../../meta";
import { gameData } from "../../sim/testing/game-data";
import { compareTarget, gridEntries } from "./collection-grid";

const data = gameData();
const rings = data.items.filter((i) => i.slotType === "ring");

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
    let save = { ...emptySave(), items: { [rings[0]!.id]: 3, [rings[1]!.id]: 1 } };
    save = equip(save, data, "stonehorn", rings[0]!.id);
    const of = (hero: string, id: string) => gridEntries(data, save, hero, "ring").find((entry) => entry.item.id === id)!;
    expect(of("stonehorn", rings[0]!.id)).toMatchObject({ owned: true, level: 3, equipped: true });
    expect(of("stonehorn", rings[1]!.id)).toMatchObject({ owned: true, level: 1, equipped: false });
    expect(of("sparkshot", rings[0]!.id)).toMatchObject({ owned: true, level: 3, equipped: false });
    expect(of("stonehorn", rings[2]!.id)).toMatchObject({ owned: false, level: 0, equipped: false });
  });

  it("compares with the item the new one would replace", () => {
    let save = { ...emptySave(), items: { [rings[0]!.id]: 3, [rings[1]!.id]: 2, [rings[2]!.id]: 1 } };
    expect(compareTarget(data, save, "stonehorn", rings[0]!)).toBeUndefined();
    save = equip(save, data, "stonehorn", rings[0]!.id);
    // the second ring slot is free
    expect(compareTarget(data, save, "stonehorn", rings[1]!)).toBeUndefined();
    save = equip(save, data, "stonehorn", rings[1]!.id);
    expect(compareTarget(data, save, "stonehorn", rings[2]!)).toEqual({ item: rings[0], level: 3 });
    // an item that is worn is not compared with itself
    expect(compareTarget(data, save, "stonehorn", rings[1]!)).toBeUndefined();
  });
});
