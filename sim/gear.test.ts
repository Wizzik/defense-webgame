import { describe, expect, it } from "vitest";
import type { GameData } from "../data/schema";
import { basicItemIndex, itemStatAt, type LoadoutEntry, SLOT_COUNT, SLOT_IDS, slotTypeOf } from "./gear";
import { stateHash } from "./hash";
import { heroStats } from "./hero";
import { NO_INPUT } from "./input";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";
import { updateCrystals } from "./crystals";

/** Game data whose common item of `type` has the single stat row `stat: value`. */
function dataWith(type: string, stat: string, value: number): { data: GameData; id: string } {
  const data = gameData();
  const item = data.items.find((i) => i.rarity === "common" && i.slotType === type)!;
  item.stats = [{ stat: stat as never, value }];
  return { data, id: item.id };
}

describe("gear", () => {
  it("has 16 slots of 14 types", () => {
    expect(SLOT_IDS.length).toBe(SLOT_COUNT);
    expect(slotTypeOf(SLOT_IDS.indexOf("ring2"))).toBe("ring");
    expect(slotTypeOf(SLOT_IDS.indexOf("trinket1"))).toBe("trinket");
    expect(slotTypeOf(SLOT_IDS.indexOf("mainHand"))).toBe("mainHand");
    expect(new Set(SLOT_IDS.map((_, i) => slotTypeOf(i))).size).toBe(14);
  });

  it("an item's numbers grow by levelStep per level", () => {
    expect(itemStatAt(10, 1, 0.15)).toBe(10);
    expect(itemStatAt(10, 3, 0.15)).toBeCloseTo(13, 9);
  });

  it("finds the common item of a slot type", () => {
    const data = gameData();
    const index = basicItemIndex(data, "feet");
    expect(data.items[index]).toMatchObject({ slotType: "feet", rarity: "common" });
  });

  it("a +10 str item of level 2 adds 11.5 str to the stats and the hero starts at full hp", () => {
    const { data, id } = dataWith("shoulders", "str", 10);
    const plain = createRun(data, { seed: 1 });
    const geared = createRun(data, { seed: 1, loadout: [{ slot: "shoulders", item: id, level: 2 }] });
    expect(geared.hero.gear.str).toBeCloseTo(11.5, 9);
    expect(geared.hero.stats.maxHp - plain.hero.stats.maxHp).toBeCloseTo(11.5 * data.constants.strHitPointBonus, 9);
    expect(geared.hero.hp).toBe(geared.hero.stats.maxHp);
    expect(geared.hero.stats.regenPerSecond - plain.hero.stats.regenPerSecond).toBeCloseTo(11.5 * data.rules.hero.regenPerStr, 9);
    expect(geared.hero.str).toBe(plain.hero.str);
    expect(geared.gear.base[SLOT_IDS.indexOf("shoulders")]).toBe(2);
    expect(geared.gear.temp[SLOT_IDS.indexOf("shoulders")]).toBe(0);
  });

  it("hp, armor and regen are added", () => {
    const stat = (type: string, name: string, value: number) => {
      const { data, id } = dataWith(type, name, value);
      const slot = SLOT_IDS[SLOT_IDS.findIndex((_, i) => slotTypeOf(i) === type)]!;
      return {
        plain: createRun(data, { seed: 1 }).hero.stats,
        geared: createRun(data, { seed: 1, loadout: [{ slot, item: id, level: 1 }] }).hero.stats,
      };
    };
    const hp = stat("chest", "hp", 72);
    expect(hp.geared.maxHp - hp.plain.maxHp).toBeCloseTo(72, 9);
    const armor = stat("offHand", "armor", 1.5);
    expect(armor.geared.armor - armor.plain.armor).toBeCloseTo(1.5, 9);
    const regen = stat("waist", "regen", 0.6);
    expect(regen.geared.regenPerSecond - regen.plain.regenPerSecond).toBeCloseTo(0.6, 9);
  });

  it("damage, attack speed and move speed add up with the auras", () => {
    const run = createRun(gameData(), { seed: 1 });
    const hero = run.hero;
    const base = { ...heroStats(run.data, hero, { ...hero.stats }) };
    hero.bonus.damage = 0.1;
    hero.bonus.moveSpeed = 0.1;
    hero.bonus.attackSpeed = 0.1;
    hero.gear.damage = 0.05;
    hero.gear.moveSpeed = 0.05;
    hero.gear.attackSpeed = 0.05;
    const out = heroStats(run.data, hero, { ...hero.stats });
    expect(out.damageMin).toBeCloseTo(base.damageMin * 1.15, 9);
    expect(out.damageMax).toBeCloseTo(base.damageMax * 1.15, 9);
    expect(out.moveSpeed).toBeCloseTo(base.moveSpeed * 1.15, 9);
    const haste = 1 + hero.agi * run.data.constants.agiAttackSpeedBonus;
    expect(out.attackIntervalSeconds).toBeCloseTo(hero.def.baseAttack.cooldown / (haste + 0.15), 9);
  });

  it("spell power multiplies the power from INT", () => {
    const run = createRun(gameData(), { seed: 1 });
    const hero = run.hero;
    hero.gear.int = 10;
    hero.gear.spellPower = 0.2;
    const out = heroStats(run.data, hero, { ...hero.stats });
    const int = hero.int + 10;
    expect(out.spellPower).toBeCloseTo((1 + int * run.data.rules.hero.spellPowerPerInt) * 1.2, 9);
    expect(out.cooldownScale).toBeCloseTo(1 / (1 + int * run.data.rules.hero.cooldownSpeedPerInt), 9);
  });

  it("magnet widens the reach of crystal pickup by its value", () => {
    const { data, id } = dataWith("neck", "magnet", 60);
    const reach = data.rules.progression.magnetRadius;
    const attracted = (loadout: LoadoutEntry[]) => {
      const run = createRun(data, { seed: 1, loadout });
      const slot = run.crystals.drop(run.hero.x + reach + 30, run.hero.y, 1);
      updateCrystals(run);
      return run.crystals.attracted[slot];
    };
    expect(attracted([])).toBe(0);
    expect(attracted([{ slot: "neck", item: id, level: 1 }])).toBe(1);
  });

  it("ignores loadout entries that are not valid", () => {
    const data = gameData();
    const ring = data.items.find((i) => i.slotType === "ring")!.id;
    const boots = data.items.find((i) => i.slotType === "feet")!.id;
    const run = createRun(data, {
      seed: 1,
      loadout: [
        { slot: "head", item: "no-such-item", level: 1 },
        { slot: "head", item: boots, level: 1 },
        { slot: "feet", item: boots, level: 0 },
        { slot: "feet", item: boots, level: data.rules.gear.maxPermanentLevel + 1 },
        { slot: "feet", item: boots, level: 1.5 },
        { slot: "nowhere" as never, item: boots, level: 1 },
        { slot: "ring1", item: ring, level: 2 },
        { slot: "ring1", item: ring, level: 3 },
        { slot: "ring2", item: ring, level: 1 },
      ],
    });
    const items = Array.from(run.gear.item);
    expect(items.filter((i) => i >= 0).length).toBe(1);
    expect(run.gear.item[SLOT_IDS.indexOf("ring1")]).toBe(data.items.findIndex((i) => i.id === ring));
    expect(run.gear.base[SLOT_IDS.indexOf("ring1")]).toBe(2);
    expect(run.hero.gear.goldFind).toBeCloseTo(0.06 * 1.15, 9);
  });

  it("the same seed and gear give the same hash, other gear another", () => {
    const data = gameData();
    const boots = data.items.find((i) => i.slotType === "feet")!.id;
    const play = (loadout: LoadoutEntry[]) => {
      const run = createRun(data, { seed: 7, loadout });
      for (let i = 0; i < 120; i++) run.step(NO_INPUT);
      return stateHash(run);
    };
    const a = play([{ slot: "feet", item: boots, level: 1 }]);
    expect(play([{ slot: "feet", item: boots, level: 1 }])).toBe(a);
    expect(play([{ slot: "feet", item: boots, level: 2 }])).not.toBe(a);
    expect(play([])).not.toBe(a);
  });
});
