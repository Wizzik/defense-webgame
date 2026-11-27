import { describe, expect, it } from "vitest";
import { RARITIES, SLOT_TYPES, STAT_IDS } from "../data/schema";
import { bossPower, chestPower, levelAtPower, rollItem, rowPoints } from "./item-roll";
import { Rng } from "./rng";
import { gameData } from "./testing/game-data";

const data = gameData();
const loot = data.rules.loot;

describe("rolling random items", () => {
  it("is deterministic: the same seed gives the same item", () => {
    const a = rollItem(data, new Rng(7), "head", "epic", 6, "int");
    const b = rollItem(data, new Rng(7), "head", "epic", 6, "int");
    expect(a).toEqual(b);
  });

  it("every rarity has the base's implicit row and affixCount affixes, no stat twice", () => {
    const rng = new Rng(3);
    for (const rarity of RARITIES) {
      for (const type of SLOT_TYPES) {
        const item = rollItem(data, rng, type, rarity, 12, "agi");
        const base = data.loot.bases[item.base]!;
        expect(base.slotType).toBe(type);
        expect(item.stats).toHaveLength(1 + loot.affixCount[rarity]);
        expect(STAT_IDS[item.stats[0]!]).toBe(base.implicit.stat);
        expect(item.values[0]).toBe(base.implicit.value);
        expect(new Set(item.stats).size).toBe(item.stats.length);
        expect(item.rarity).toBe(RARITIES.indexOf(rarity));
        expect(item.effect >= 0).toBe(rarity === "mythic");
        expect(item.nameFirst >= 0).toBe(loot.affixCount[rarity] >= 3);
      }
    }
  });

  it("the rows sum to the rarity's budget within the row roll", () => {
    const rng = new Rng(11);
    for (let n = 0; n < 400; n++) {
      const rarity = RARITIES[n % RARITIES.length]!;
      const item = rollItem(data, rng, SLOT_TYPES[n % SLOT_TYPES.length]!, rarity, n % 13, (["str", "agi", "int"] as const)[n % 3]!);
      const points = item.stats.reduce((sum, stat, r) => sum + rowPoints(data, stat, item.values[r]!), 0);
      const budget = loot.budget[rarity];
      const affixes = budget - loot.implicitPoints;
      expect(points).toBeGreaterThanOrEqual(loot.implicitPoints + affixes * (1 - loot.rowRoll) - 1e-9);
      expect(points).toBeLessThanOrEqual(loot.implicitPoints + affixes * (1 + loot.rowRoll) + 1e-9);
    }
  });

  it("low power rolls only T1; T4 needs its power and never comes past an affix's maxTier", () => {
    const rng = new Rng(5);
    let sawT4 = false;
    for (let n = 0; n < 300; n++) {
      const low = rollItem(data, rng, "chest", "legendary", 0, "str");
      expect(low.tiers.slice(1).every((t) => t === 0)).toBe(true);
      const high = rollItem(data, rng, "chest", "legendary", 12, "str");
      high.tiers.slice(1).forEach((t, k) => {
        const affix = data.loot.affixes.find((a) => a.stat === STAT_IDS[high.stats[k + 1]!])!;
        expect(t + 1).toBeLessThanOrEqual(affix.maxTier ?? 4);
        if (t === 3) sawT4 = true;
      });
    }
    expect(sawT4).toBe(true);
  });

  it("smart loot: about 60 % of the affixes come from the hero's pool, more than chance would give", () => {
    const rng = new Rng(9);
    const pool = new Set(data.loot.affixes.filter((a) => a.tags.includes("int")).map((a) => STAT_IDS.indexOf(a.stat)));
    let own = 0;
    let all = 0;
    let ownBase = 0;
    const rolls = 2000;
    for (let n = 0; n < rolls; n++) {
      const item = rollItem(data, rng, "head", "epic", 6, "int");
      for (const stat of item.stats.slice(1)) {
        all++;
        if (pool.has(stat)) own++;
      }
      if (data.loot.bases[item.base]!.flavour === "int") ownBase++;
    }
    const chance = pool.size / data.loot.affixes.length;
    // 60 % from the pool, plus the pool's share of the other 40 %
    const expected = loot.smartShare + (1 - loot.smartShare) * chance;
    expect(own / all).toBeGreaterThan(expected - 0.06);
    expect(own / all).toBeLessThan(expected + 0.06);
    expect(ownBase / rolls).toBeGreaterThan(0.6);
  });

  it("item power: chests by phase, bosses by order, plus world and difficulty; the level follows the power", () => {
    expect(chestPower(data, 1, 1, "normal")).toBeCloseTo(loot.power.chestBase + loot.power.chestPerPhase, 12);
    expect(chestPower(data, 20, 5, "hell")).toBeCloseTo(
      loot.power.chestBase + 20 * loot.power.chestPerPhase + 4 * loot.power.perWorld + loot.power.difficulty.hell, 12);
    expect(bossPower(data, 0, 1, "normal")).toBe(loot.power.boss[0]);
    expect(bossPower(data, 9, 1, "normal")).toBe(loot.power.boss[loot.power.boss.length - 1]);
    expect(levelAtPower(data, 0)).toBe(1);
    expect(levelAtPower(data, 2.99)).toBe(1);
    expect(levelAtPower(data, 3)).toBe(2);
    expect(levelAtPower(data, bossPower(data, 3, 5, "hell"))).toBe(5);
  });
});
