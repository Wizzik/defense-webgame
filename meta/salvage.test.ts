import { describe, expect, it } from "vitest";
import { gameData } from "../sim/testing/game-data";
import { canSalvage, salvage, salvageValue, takeBank } from "./salvage";
import { emptySave, type SaveData } from "./save";

const data = gameData();
const helm = data.items.find((i) => i.slotType === "head" && i.rarity === "rare")!.id;
const rolled = (uid: number, rarity: "common" | "epic" | "mythic") => ({
  uid, rarity, level: 1, base: data.loot.bases.find((b) => b.slotType === "head")!.id, rows: [["armor", 2, -1]] as [
    "armor", number, number][],
});

function save(): SaveData {
  return {
    ...emptySave(), nextUid: 5,
    items: [{ uid: 1, rarity: "rare", level: 2, named: helm }, rolled(2, "epic"), rolled(3, "mythic"), rolled(4, "common")],
    loadouts: { stonehorn: { head: 3 } },
  };
}

describe("salvage", () => {
  it("takes only random items that no doll wears", () => {
    const s = save();
    expect(canSalvage(s, 1)).toBe(false); // named
    expect(canSalvage(s, 3)).toBe(false); // worn by stonehorn
    expect(canSalvage(s, 9)).toBe(false); // not owned
    expect(canSalvage(s, 2)).toBe(true);
    expect(salvage(data, s, 3)).toBe(s);
  });

  it("removes the record and puts the rarity's gold into the bank, kept to the limit", () => {
    const after = salvage(data, save(), 2);
    expect(after.items.map((r) => r.uid)).toEqual([1, 3, 4]);
    expect(after.bankGold).toBe(data.rules.loot.salvageGold.epic);
    expect(salvageValue(data, save(), 4)).toBe(data.rules.loot.salvageGold.common);
    const full = salvage(data, { ...save(), bankGold: data.rules.loot.bankLimit - 5 }, 2);
    expect(full.bankGold).toBe(data.rules.loot.bankLimit);
    expect(full.items).toHaveLength(3);
  });

  it("a run takes the whole bank and leaves it empty", () => {
    const { save: after, gold } = takeBank({ ...save(), bankGold: 75 });
    expect(gold).toBe(75);
    expect(after.bankGold).toBe(0);
    const empty = save();
    expect(takeBank(empty)).toEqual({ save: empty, gold: 0 });
  });
});
