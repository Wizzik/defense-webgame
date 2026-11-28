import { describe, expect, it } from "vitest";
import { STAT_IDS } from "../../data/schema";
import { ChestAction, GearState, itemStatAt, Rng, rollItem } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { compareLines } from "./chest-compare-lines";
import { statLabel, statValue } from "./item-lines";

function setup() {
  const data = gameData();
  data.items.push(
    {
      id: "test-helm", name: { en: "Test Helm", cs: "Zkušební přilba" }, slotType: "head", rarity: "rare",
      stats: [{ stat: "str", value: 14 }, { stat: "hp", value: 120 }, { stat: "armor", value: 4 }],
    },
    {
      id: "test-crown", name: { en: "Test Crown", cs: "Zkušební koruna" }, slotType: "head", rarity: "epic",
      stats: [{ stat: "str", value: 20 }, { stat: "hp", value: 50 }, { stat: "magicFind", value: 0.1 }],
    },
    {
      id: "test-hood", name: { en: "Test Hood", cs: "Zkušební kápě" }, slotType: "head", rarity: "common",
      stats: [{ stat: "armor", value: 4 }],
    },
  );
  const n = data.items.length;
  const gear = new GearState();
  gear.item[0] = n - 3;
  gear.base[0] = 2;
  gear.temp[0] = 1;
  return { data, gear, helm: n - 3, crown: n - 2, hood: n - 1 };
}

describe("chest compare lines", () => {
  it("keep shows the worn item one level up, take the rolled item at the slot's level + 1", () => {
    const { data, gear, helm, crown } = setup();
    const info = compareLines("en", data, gear, { slot: 0, item: crown, action: ChestAction.Choice });
    expect(info.keep).toEqual({
      title: "Test Helm", rarity: "rare", rarityName: "Rare", slotType: "head", itemId: "test-helm", level: "level 3 → 4", effect: null,
    });
    expect(info.take).toEqual({
      title: "Test Crown", rarity: "epic", rarityName: "Epic", slotType: "head", itemId: "test-crown", level: "level 4 for this run", effect: null,
    });
    const cs = compareLines("cs", data, gear, { slot: 0, item: crown, action: ChestAction.Choice });
    expect(cs.keep.level).toBe("úroveň 3 → 4");
    expect(cs.take.level).toBe("úroveň 4 do konce běhu");
    expect(data.items[helm]!.name.cs).toBe(cs.keep.title);
  });

  it("rows line up by stat: the worn item's stats first, then the ones only the rolled item has", () => {
    const { data, gear, crown } = setup();
    const g = data.rules.gear;
    const keep = (stat: "str" | "hp" | "armor", v: number) => `${statValue(stat, itemStatAt(v, 2, 2, g))} ${statLabel("en", stat)}`;
    const take = (stat: "str" | "hp" | "magicFind", v: number) => `${statValue(stat, itemStatAt(v, 0, 4, g))} ${statLabel("en", stat)}`;
    const info = compareLines("en", data, gear, { slot: 0, item: crown, action: ChestAction.Choice });
    expect(info.rows.map((row) => row.stat)).toEqual(["str", "hp", "armor", "magicFind"]);
    const [str, hp, armor, mf] = info.rows;
    expect(str).toEqual({ stat: "str", keep: keep("str", 14), take: take("str", 20), keepTone: "worse", takeTone: "better", takeNew: false, keepTier: 0, takeTier: 0 });
    expect(hp).toEqual({ stat: "hp", keep: keep("hp", 120), take: take("hp", 50), keepTone: "better", takeTone: "worse", takeNew: false, keepTier: 0, takeTier: 0 });
    expect(armor).toEqual({ stat: "armor", keep: keep("armor", 4), take: "", keepTone: "better", takeTone: "plain", takeNew: false, keepTier: 0, takeTier: 0 });
    expect(mf).toEqual({ stat: "magicFind", keep: "", take: take("magicFind", 0.1), keepTone: "plain", takeTone: "better", takeNew: true, keepTier: 0, takeTier: 0 });
  });

  it("a lifesteal row shows a percent on the side that has it", () => {
    const { data, gear, crown } = setup();
    data.items[crown]!.stats = [{ stat: "str", value: 20 }, { stat: "hp", value: 50 }, { stat: "lifesteal", value: 0.015 }];
    const info = compareLines("en", data, gear, { slot: 0, item: crown, action: ChestAction.Choice });
    const row = info.rows.find((r) => r.stat === "lifesteal")!;
    expect(row.keep).toBe("");
    expect(row.take).toMatch(/^\+\d+(\.\d)? % lifesteal$/);
    expect(row.takeTone).toBe("better");
    expect(row.takeNew).toBe(true);
  });

  it("equal values are plain on both sides", () => {
    const { data, crown, hood } = setup();
    const gear = new GearState();
    gear.item[0] = hood;
    gear.base[0] = 0;
    gear.temp[0] = 3;
    data.items[crown]!.stats = [{ stat: "armor", value: 4 }];
    const info = compareLines("en", data, gear, { slot: 0, item: crown, action: ChestAction.Choice });
    expect(info.rows).toEqual([
      { stat: "armor", keep: info.rows[0]!.keep, take: info.rows[0]!.take, keepTone: "plain", takeTone: "plain", takeNew: false, keepTier: 0, takeTier: 0 },
    ]);
    expect(info.rows[0]!.keep).toBe(info.rows[0]!.take);
  });

  it("a legendary or mythic effect goes under its own column", () => {
    const { data, gear } = setup();
    // named items have an effect each since 2026-11-28: a plain blade for the side without one
    data.items.push({
      id: "test-blade", name: { en: "Test Blade", cs: "Zkušební čepel" }, slotType: "mainHand", rarity: "common",
      stats: [{ stat: "damage", value: 0.03 }],
    });
    gear.item[14] = data.items.length - 1;
    gear.temp[14] = 1;
    const sword = data.items.findIndex((i) => i.id === "skysplitter");
    const info = compareLines("cs", data, gear, { slot: 14, item: sword, action: ChestAction.Choice });
    expect(info.take.effect).toBe(data.items[sword]!.effect!.text.cs);
    expect(info.keep.effect).toBeNull();
    const worn = new GearState();
    worn.item[14] = sword;
    worn.temp[14] = 1;
    const back = compareLines("cs", data, worn, { slot: 14, item: gear.item[14]!, action: ChestAction.Choice });
    expect(back.keep.effect).toBe(data.items[sword]!.effect!.text.cs);
    expect(back.take.effect).toBeNull();
  });

  it("a rolled item's affix rows carry their tier, its base row none, and its rarity says random", () => {
    const { data, gear } = setup();
    gear.item[0] = data.items.findIndex((i) => i.id === "test-hood");
    const rolled = rollItem(data, new Rng(5), "head", "epic", 9, "str");
    const info = compareLines("en", data, gear, { slot: 0, item: -1, action: ChestAction.Choice, rolled });
    expect(info.take.rarityName).toBe("Epic random item");
    for (const [r, stat] of rolled.stats.entries()) {
      const row = info.rows.find((candidate) => candidate.stat === STAT_IDS[stat])!;
      expect(row.takeTier).toBe(r === 0 ? 0 : rolled.tiers[r]! + 1);
    }
    expect(info.rows.every((row) => row.keepTier === 0)).toBe(true);
  });
});
