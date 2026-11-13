import { describe, expect, it } from "vitest";
import { gameData } from "../sim/testing/game-data";
import { emptySave, parseSave } from "./save";

const data = gameData();
const helm = data.items.find((i) => i.slotType === "head" && i.rarity === "rare")!.id;
const boots = data.items.find((i) => i.slotType === "feet" && i.rarity === "rare")!.id;
const ring = data.items.find((i) => i.slotType === "ring" && i.rarity === "rare")!.id;

describe("parseSave", () => {
  it("nothing saved yet is an empty save with nothing dropped", () => {
    expect(parseSave(null, data)).toEqual({ save: emptySave(), dropped: 0 });
    expect(parseSave(undefined, data)).toEqual({ save: emptySave(), dropped: 0 });
    expect(emptySave()).toEqual({ version: 1, items: {}, loadouts: {} });
  });

  it("data that is not a save of version 1 gives an empty save and counts as dropped", () => {
    for (const raw of ["text", 5, [], { items: { [helm]: 1 } }, { version: 99, items: { [helm]: 1 }, loadouts: {} }]) {
      expect(parseSave(raw, data), JSON.stringify(raw)).toEqual({ save: emptySave(), dropped: 1 });
    }
  });

  it("keeps a valid save as it is", () => {
    const raw = { version: 1, items: { [helm]: 3, [ring]: 1 }, loadouts: { stonehorn: { head: helm, ring2: ring } } };
    const { save, dropped } = parseSave(JSON.parse(JSON.stringify(raw)), data);
    expect(dropped).toBe(0);
    expect(save).toEqual(raw);
  });

  it("drops unknown items and levels that are not whole numbers from 1 to the top level", () => {
    const { save, dropped } = parseSave({
      version: 1,
      items: { "no-such-item": 2, [helm]: 0, [boots]: 6, [ring]: 2.5, "travelers-hood": 2, "tin-ring": "3" },
      loadouts: {},
    }, data);
    expect(save.items).toEqual({ "travelers-hood": 2 });
    expect(dropped).toBe(5);
  });

  it("drops loadout entries that do not fit and keeps the rest", () => {
    const { save, dropped } = parseSave({
      version: 1,
      items: { [helm]: 1, [boots]: 2, [ring]: 1 },
      loadouts: {
        stonehorn: { head: helm, feet: helm, chest: "travelers-hood", ring1: ring, ring2: ring, nowhere: boots },
        "no-such-hero": { head: helm },
        sparkshot: "broken",
        tidecaller: { feet: boots },
      },
    }, data);
    expect(save.loadouts).toEqual({ stonehorn: { head: helm, ring1: ring }, tidecaller: { feet: boots } });
    // feet: wrong type; chest: not owned; ring2: the same ring twice; nowhere: no such slot; one unknown hero; one broken loadout
    expect(dropped).toBe(6);
    expect(save.items).toEqual({ [helm]: 1, [boots]: 2, [ring]: 1 });
  });

  it("survives broken parts", () => {
    expect(parseSave({ version: 1, items: "x", loadouts: 7 }, data)).toEqual({ save: emptySave(), dropped: 2 });
    expect(parseSave({ version: 1 }, data)).toEqual({ save: emptySave(), dropped: 0 });
    expect(parseSave({ version: 1, items: null, loadouts: [] }, data).save).toEqual(emptySave());
  });
});
