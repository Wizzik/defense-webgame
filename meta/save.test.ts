import { describe, expect, it } from "vitest";
import { gameData } from "../sim/testing/game-data";
import { emptySave, namedLevels, parseSave } from "./save";

const data = gameData();
const helm = data.items.filter((i) => i.slotType === "head" && i.rarity === "legendary")[1]!.id;
const boots = data.items.filter((i) => i.slotType === "feet" && i.rarity === "legendary")[1]!.id;
const ring = data.items.filter((i) => i.slotType === "ring" && i.rarity === "legendary")[1]!.id;
const named = (uid: number, id: string, level: number) =>
  ({ uid, rarity: data.items.find((i) => i.id === id)!.rarity, level, named: id });
/** A stored rolled head item. */
const rolledHead = (uid: number, level = 2) => ({
  uid, rarity: "epic", level, base: "iron-helm",
  rows: [["armor", 0.5, -1], ["str", 3, 1], ["hp", 70, 0], ["lifesteal", 0.01, 0]], name: [0, 0],
});

describe("parseSave", () => {
  it("nothing saved yet is an empty save of version 2 with nothing dropped", () => {
    expect(parseSave(null, data)).toEqual({ save: emptySave(), dropped: 0 });
    expect(parseSave(undefined, data)).toEqual({ save: emptySave(), dropped: 0 });
    expect(emptySave()).toEqual({ version: 2, items: [], nextUid: 1, loadouts: {}, bankGold: 0 });
  });

  it("data that is not a save of version 1 or 2 gives an empty save and counts as dropped", () => {
    for (const raw of ["text", 5, [], { items: { [helm]: 1 } }, { version: 99, items: [], loadouts: {} }]) {
      expect(parseSave(raw, data), JSON.stringify(raw)).toEqual({ save: emptySave(), dropped: 1 });
    }
  });

  describe("version 1 turns into named records", () => {
    it("keeps the items with their levels and the loadouts by uid", () => {
      const raw = { version: 1, items: { [helm]: 3, [ring]: 1 }, loadouts: { stonehorn: { head: helm, ring2: ring } } };
      const { save, dropped } = parseSave(JSON.parse(JSON.stringify(raw)), data);
      expect(dropped).toBe(0);
      expect(save).toEqual({
        version: 2, items: [named(1, helm, 3), named(2, ring, 1)], nextUid: 3,
        loadouts: { stonehorn: { head: 1, ring2: 2 } }, bankGold: 0,
      });
      expect(namedLevels(save)).toEqual({ [helm]: 3, [ring]: 1 });
    });

    it("drops unknown items and levels that are not whole numbers from 1 to the top level", () => {
      const { save, dropped } = parseSave({
        version: 1,
        items: { "no-such-item": 2, [helm]: 0, [boots]: 6, [ring]: 2.5, "travelers-hood": 2, "tin-ring": "3" },
        loadouts: {},
      }, data);
      expect(namedLevels(save)).toEqual({ "travelers-hood": 2 });
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
      expect(save.loadouts).toEqual({ stonehorn: { head: 1, ring1: 3 }, tidecaller: { feet: 2 } });
      // feet: wrong type; chest: not owned; ring2: the same ring twice; nowhere: no such slot; one unknown hero; one broken loadout
      expect(dropped).toBe(6);
    });

    it("survives broken parts", () => {
      expect(parseSave({ version: 1, items: "x", loadouts: 7 }, data)).toEqual({ save: emptySave(), dropped: 2 });
      expect(parseSave({ version: 1 }, data)).toEqual({ save: emptySave(), dropped: 0 });
      expect(parseSave({ version: 1, items: null, loadouts: [] }, data).save).toEqual(emptySave());
    });
  });

  describe("version 2", () => {
    it("keeps a valid save as it is, named and rolled records", () => {
      const raw = {
        version: 2, items: [named(1, helm, 3), rolledHead(4), named(2, ring, 1)], nextUid: 7,
        loadouts: { stonehorn: { head: 4, ring2: 2 }, sparkshot: { head: 1 } }, bankGold: 120,
      };
      const { save, dropped } = parseSave(JSON.parse(JSON.stringify(raw)), data);
      expect(dropped).toBe(0);
      expect(save).toEqual(raw);
    });

    it("reads the bank: missing is empty, too much is cut to the limit, a broken one is dropped", () => {
      const base = { version: 2, items: [named(1, helm, 3)], nextUid: 2, loadouts: {} };
      expect(parseSave(base, data).save.bankGold).toBe(0);
      expect(parseSave({ ...base, bankGold: 99_999 }, data).save.bankGold).toBe(data.rules.loot.bankLimit);
      for (const bankGold of [-5, 2.5, "40", null]) {
        const { save, dropped } = parseSave({ ...base, bankGold }, data);
        expect(save.bankGold).toBe(0);
        expect(dropped).toBe(1);
      }
    });

    it("drops broken records, a uid twice, a named item twice, and keeps the rest", () => {
      const { save, dropped } = parseSave({
        version: 2, nextUid: 2,
        items: [
          named(1, helm, 3), named(1, ring, 1), named(2, helm, 2), rolledHead(3), "x", { uid: 9, level: 1 },
          { ...rolledHead(4), base: "no-such-base" }, { ...rolledHead(5), rows: [["luck", 1, 0]] },
          { ...rolledHead(6), rows: [["str", 1, 0], ["str", 2, 0]] }, { ...rolledHead(7), level: 6 },
          { ...rolledHead(8), rows: [["str", -1, 0]] }, { ...rolledHead(10), rarity: "golden" },
        ],
        loadouts: {},
      }, data);
      expect(save.items.map((r) => r.uid)).toEqual([1, 3]);
      expect(dropped).toBe(10);
      // the next uid is above every kept one, whatever the file said
      expect(save.nextUid).toBe(4);
    });

    it("an unknown effect or name is left out and the item kept", () => {
      const { save, dropped } = parseSave({
        version: 2, nextUid: 3, loadouts: {},
        items: [{ ...rolledHead(1), effect: 99, name: [999, 0] }, { ...rolledHead(2), effect: 0 }],
      }, data);
      expect(dropped).toBe(0);
      expect(save.items[0]).not.toHaveProperty("effect");
      expect(save.items[0]).not.toHaveProperty("name");
      expect(save.items[1]!.effect).toBe(0);
    });

    it("a loadout may only wear an owned record of the slot's type, once", () => {
      const { save, dropped } = parseSave({
        version: 2, nextUid: 3, items: [rolledHead(1), named(2, ring, 1)],
        loadouts: { stonehorn: { head: 1, feet: 1, ring1: 2, ring2: 2, chest: 9, neck: "x" } },
      }, data);
      expect(save.loadouts).toEqual({ stonehorn: { head: 1, ring1: 2 } });
      expect(dropped).toBe(4);
    });

    it("keeps at most twice the collection limit", () => {
      const limit = data.rules.loot.collectionLimit;
      const items = Array.from({ length: limit * 2 + 5 }, (_, i) => rolledHead(i + 1));
      const { save, dropped } = parseSave({ version: 2, nextUid: 1, items, loadouts: {} }, data);
      expect(save.items).toHaveLength(limit * 2);
      expect(dropped).toBe(5);
    });
  });
});
