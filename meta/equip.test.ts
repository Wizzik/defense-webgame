import { describe, expect, it } from "vitest";
import { createRun, ROLLED_ITEM, SLOT_IDS } from "../sim";
import { gameData } from "../sim/testing/game-data";
import { equip, grantNamed, toLoadout, unequip } from "./equip";
import type { ItemRecord } from "./item-record";
import { emptySave, namedLevels, type SaveData } from "./save";

const data = gameData();
const rings = data.items.filter((i) => i.slotType === "ring").map((i) => i.id);
const helm = data.items.find((i) => i.slotType === "head" && i.rarity === "epic")!.id;
const rolledHelm: ItemRecord = {
  uid: 50, rarity: "legendary", level: 3, base: "iron-helm",
  rows: [["armor", 0.5, -1], ["str", 4, 2], ["hp", 60, 0], ["dodge", 0.02, 1], ["thorns", 0.3, 0]], effect: 1,
};

/** A save owning the named items at these levels (uids 1, 2, ... in the given order). */
function owning(levels: Record<string, number>, extra: ItemRecord[] = []): SaveData {
  let save = emptySave();
  for (const [id, level] of Object.entries(levels)) save = grantNamed(save, data, id, level);
  return { ...save, items: [...save.items, ...extra], nextUid: Math.max(save.nextUid, ...extra.map((r) => r.uid + 1)) };
}
const uidOf = (save: SaveData, id: string) => save.items.find((r) => r.named === id)!.uid;

describe("equip", () => {
  it("the first ring goes to ring1, the second to ring2, the third replaces ring1", () => {
    let save = owning({ [rings[0]!]: 1, [rings[1]!]: 1, [rings[2]!]: 1 });
    save = equip(save, data, "stonehorn", 1);
    expect(save.loadouts.stonehorn).toEqual({ ring1: 1 });
    save = equip(save, data, "stonehorn", 2);
    expect(save.loadouts.stonehorn).toEqual({ ring1: 1, ring2: 2 });
    save = equip(save, data, "stonehorn", 3);
    expect(save.loadouts.stonehorn).toEqual({ ring1: 3, ring2: 2 });
  });

  it("a ring that is worn stays where it is", () => {
    let save = owning({ [rings[0]!]: 1, [rings[1]!]: 1 });
    save = equip(equip(save, data, "stonehorn", 1), data, "stonehorn", 2);
    expect(equip(save, data, "stonehorn", 2)).toEqual(save);
    expect(equip(save, data, "stonehorn", 1)).toEqual(save);
  });

  it("an item of another type replaces what its slot holds; every hero has its own doll", () => {
    const other = data.items.find((i) => i.slotType === "head" && i.rarity === "rare")!.id;
    let save = owning({ [helm]: 2, [other]: 1 });
    save = equip(save, data, "stonehorn", uidOf(save, helm));
    save = equip(save, data, "sparkshot", uidOf(save, helm));
    save = equip(save, data, "stonehorn", uidOf(save, other));
    expect(save.loadouts).toEqual({ stonehorn: { head: uidOf(save, other) }, sparkshot: { head: uidOf(save, helm) } });
  });

  it("a rolled item is equipped by its uid like a named one", () => {
    let save = owning({ [helm]: 1 }, [rolledHelm]);
    save = equip(save, data, "stonehorn", 50);
    expect(save.loadouts.stonehorn).toEqual({ head: 50 });
  });

  it("a uid that is not owned or an unknown hero changes nothing", () => {
    const save = owning({ [helm]: 1 });
    expect(equip(save, data, "stonehorn", 99)).toEqual(save);
    expect(equip(save, data, "no-such-hero", 1)).toEqual(save);
  });

  it("unequip empties the slot", () => {
    const save = equip(owning({ [helm]: 1 }), data, "stonehorn", 1);
    expect(unequip(save, "stonehorn", "head").loadouts.stonehorn).toEqual({});
    expect(unequip(save, "stonehorn", "feet")).toEqual(save);
    expect(unequip(save, "sparkshot", "head")).toEqual(save);
  });

  it("toLoadout carries the permanent levels and the rolled items", () => {
    let save = owning({ [helm]: 4, [rings[0]!]: 2 }, [{ ...rolledHelm }]);
    save = equip(equip(save, data, "stonehorn", uidOf(save, helm)), data, "stonehorn", uidOf(save, rings[0]!));
    expect(toLoadout(save, data, "stonehorn")).toEqual([
      { slot: "head", item: helm, level: 4 },
      { slot: "ring1", item: rings[0], level: 2 },
    ]);
    save = equip(save, data, "stonehorn", 50);
    const [head] = toLoadout(save, data, "stonehorn");
    expect(head).toMatchObject({ slot: "head", item: "rolled-iron-helm", level: 3 });
    expect(head!.rolled!.stats).toHaveLength(5);
    expect(toLoadout(save, data, "sparkshot")).toEqual([]);
  });

  it("a run starts with the rolled item of the loadout, at its level", () => {
    let save = owning({}, [{ ...rolledHelm }]);
    save = equip(save, data, "stonehorn", 50);
    const run = createRun(data, { seed: 1, hero: "stonehorn", loadout: toLoadout(save, data, "stonehorn") });
    const head = SLOT_IDS.indexOf("head");
    expect(run.gear.item[head]).toBe(ROLLED_ITEM);
    expect(run.gear.base[head]).toBe(3);
    const { levelStep } = data.rules.gear;
    expect(run.hero.gear.str).toBeCloseTo(4 * (1 + levelStep * 2), 9);
    expect(run.hero.gear.dodge).toBeCloseTo(0.02 * (1 + levelStep * 2), 9);
    // effect 1 of rules.loot.mythicEffects is the splash
    expect(run.gear.fx.splashChance).toBeGreaterThan(0);
  });

  it("grantNamed adds a named record or sets its level, clamped", () => {
    let save = grantNamed(emptySave(), data, helm, 9);
    expect(namedLevels(save)).toEqual({ [helm]: data.rules.gear.maxPermanentLevel });
    save = grantNamed(save, data, helm, 2);
    expect(save.items).toHaveLength(1);
    expect(namedLevels(save)).toEqual({ [helm]: 2 });
    expect(grantNamed(save, data, "no-such-item", 1)).toBe(save);
  });

  it("the functions do not change their input", () => {
    const save = equip(owning({ [helm]: 1, [rings[0]!]: 1 }), data, "stonehorn", 1);
    const copy = JSON.parse(JSON.stringify(save));
    equip(save, data, "stonehorn", 2);
    unequip(save, "stonehorn", "head");
    toLoadout(save, data, "stonehorn");
    grantNamed(save, data, helm, 3);
    expect(save).toEqual(copy);
  });
});
