import { describe, expect, it } from "vitest";
import { gameData } from "../sim/testing/game-data";
import { equip, toLoadout, unequip } from "./equip";
import { emptySave, type SaveData } from "./save";

const data = gameData();
const rings = data.items.filter((i) => i.slotType === "ring").map((i) => i.id);
const helm = data.items.find((i) => i.slotType === "head" && i.rarity === "epic")!.id;

function owning(levels: Record<string, number>): SaveData {
  return { ...emptySave(), items: levels };
}

describe("equip", () => {
  it("the first ring goes to ring1, the second to ring2, the third replaces ring1", () => {
    let save = owning({ [rings[0]!]: 1, [rings[1]!]: 1, [rings[2]!]: 1 });
    save = equip(save, data, "stonehorn", rings[0]!);
    expect(save.loadouts.stonehorn).toEqual({ ring1: rings[0] });
    save = equip(save, data, "stonehorn", rings[1]!);
    expect(save.loadouts.stonehorn).toEqual({ ring1: rings[0], ring2: rings[1] });
    save = equip(save, data, "stonehorn", rings[2]!);
    expect(save.loadouts.stonehorn).toEqual({ ring1: rings[2], ring2: rings[1] });
  });

  it("a ring that is worn stays where it is", () => {
    let save = owning({ [rings[0]!]: 1, [rings[1]!]: 1 });
    save = equip(equip(save, data, "stonehorn", rings[0]!), data, "stonehorn", rings[1]!);
    expect(equip(save, data, "stonehorn", rings[1]!)).toEqual(save);
    expect(equip(save, data, "stonehorn", rings[0]!)).toEqual(save);
  });

  it("an item of another type replaces what its slot holds; every hero has its own doll", () => {
    const other = data.items.find((i) => i.slotType === "head" && i.rarity === "rare")!.id;
    let save = owning({ [helm]: 2, [other]: 1 });
    save = equip(save, data, "stonehorn", helm);
    save = equip(save, data, "sparkshot", helm);
    save = equip(save, data, "stonehorn", other);
    expect(save.loadouts).toEqual({ stonehorn: { head: other }, sparkshot: { head: helm } });
  });

  it("an item that is not owned, an unknown item or an unknown hero changes nothing", () => {
    const save = owning({ [helm]: 1 });
    expect(equip(save, data, "stonehorn", rings[0]!)).toEqual(save);
    expect(equip(save, data, "stonehorn", "no-such-item")).toEqual(save);
    expect(equip(save, data, "no-such-hero", helm)).toEqual(save);
  });

  it("unequip empties the slot", () => {
    const save = equip(owning({ [helm]: 1 }), data, "stonehorn", helm);
    expect(unequip(save, "stonehorn", "head").loadouts.stonehorn).toEqual({});
    expect(unequip(save, "stonehorn", "feet")).toEqual(save);
    expect(unequip(save, "sparkshot", "head")).toEqual(save);
  });

  it("toLoadout carries the permanent levels of the collection", () => {
    let save = owning({ [helm]: 4, [rings[0]!]: 2 });
    save = equip(equip(save, data, "stonehorn", helm), data, "stonehorn", rings[0]!);
    expect(toLoadout(save, data, "stonehorn")).toEqual([
      { slot: "head", item: helm, level: 4 },
      { slot: "ring1", item: rings[0], level: 2 },
    ]);
    expect(toLoadout(save, data, "sparkshot")).toEqual([]);
  });

  it("the functions do not change their input", () => {
    const save = equip(owning({ [helm]: 1, [rings[0]!]: 1 }), data, "stonehorn", helm);
    const copy = JSON.parse(JSON.stringify(save));
    equip(save, data, "stonehorn", rings[0]!);
    unequip(save, "stonehorn", "head");
    toLoadout(save, data, "stonehorn");
    expect(save).toEqual(copy);
  });
});
