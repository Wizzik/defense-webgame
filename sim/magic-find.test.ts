import { describe, expect, it } from "vitest";
import { drawRarity, effectiveMagicFind, magicFindWeights } from "./magic-find";
import { Rng } from "./rng";

const RULES = { limit: 1.5, rarityFactor: { rare: 1, epic: 1.5, legendary: 2, mythic: 2.5 } };

function expectWeights(actual: Record<string, number | undefined>, expected: Record<string, number>): void {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  for (const [key, value] of Object.entries(expected)) expect(actual[key], key).toBeCloseTo(value, 9);
}

describe("magic find", () => {
  it("has diminishing returns", () => {
    expect(effectiveMagicFind(0, 1.5)).toBe(0);
    expect(effectiveMagicFind(-1, 1.5)).toBe(0);
    expect(effectiveMagicFind(0.5, 1.5)).toBeCloseTo(0.375, 9);
    expect(effectiveMagicFind(1, 1.5)).toBeCloseTo(0.6, 9);
    expect(effectiveMagicFind(3, 1.5)).toBeCloseTo(1, 9);
  });

  it("higher rarities grow faster, the lowest keeps its weight", () => {
    const w = magicFindWeights({ common: 55, rare: 30, epic: 12, legendary: 2.5, mythic: 0.5 }, 1, RULES);
    expectWeights(w, { common: 55, rare: 48, epic: 22.8, legendary: 5.5, mythic: 1.25 });
  });

  it("the lowest rarity of a boss table keeps its weight", () => {
    expectWeights(magicFindWeights({ epic: 75, legendary: 25 }, 1, RULES), { epic: 75, legendary: 55 });
  });

  it("no magic find leaves the weights as they are, in a new object", () => {
    const weights = { rare: 60, epic: 40 };
    const w = magicFindWeights(weights, 0, RULES);
    expect(w).toEqual(weights);
    expect(w).not.toBe(weights);
  });

  it("a huge magic find stays bounded", () => {
    const w = magicFindWeights({ common: 1, mythic: 1 }, 1e6, RULES);
    expect(w.mythic!).toBeLessThanOrEqual(1 + 1.5 * 2.5);
    expect(Number.isFinite(w.mythic!)).toBe(true);
  });

  it("drawRarity takes exactly one value from the generator and is deterministic", () => {
    const weights = { common: 55, rare: 30, epic: 12, legendary: 2.5, mythic: 0.5 };
    for (let seed = 1; seed <= 50; seed++) {
      const a = new Rng(seed);
      const b = new Rng(seed);
      const first = drawRarity(weights, a);
      expect(drawRarity(weights, new Rng(seed))).toBe(first);
      b.next();
      expect(a.state).toBe(b.state);
    }
  });

  it("drawRarity follows the weights", () => {
    const rng = new Rng(7);
    const counts: Record<string, number> = { rare: 0, epic: 0 };
    for (let i = 0; i < 4000; i++) counts[drawRarity({ rare: 75, epic: 25 }, rng)]!++;
    expect(counts.epic! / 4000).toBeGreaterThan(0.22);
    expect(counts.epic! / 4000).toBeLessThan(0.28);
  });
});
