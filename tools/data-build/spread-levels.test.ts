import { describe, expect, it } from "vitest";
import type { Ability } from "../../data/schema";
import { spreadLevels } from "./spread-levels";

const nova = (levels: number, damage: number[], stun: number[], cooldown: number[]): Ability =>
  ({
    id: "zap", name: { en: "Zap", cs: "Zap" }, description: { en: "z", cs: "z" }, kind: "nova", targeting: "around_self",
    levels, cooldown, params: { damage, stunSeconds: stun },
  }) as unknown as Ability;

describe("spreadLevels", () => {
  it("keeps level 1 and the top level and interpolates the levels between", () => {
    const out = spreadLevels(nova(5, [100, 200, 300, 400, 500], [1, 1, 1.5, 1.5, 2], [4, 4, 4, 3, 3]), 10);
    expect(out.levels).toBe(10);
    const p = out.params as Record<string, number[]>;
    expect(p.damage).toEqual([100, 144, 189, 233, 278, 322, 367, 411, 456, 500]);
    expect(p.damage![0]).toBe(100);
    expect(p.stunSeconds!.length).toBe(10);
    expect(p.stunSeconds![9]).toBe(2);
    expect(p.stunSeconds![2]).toBe(1); // 0.89 of the way from level 1 to 2: still 1
    expect(out.cooldown[0]).toBe(4);
    expect(out.cooldown[9]).toBe(3);
    expect(out.cooldown[6]).toBeCloseTo(3.33, 2); // 2/3 of the way from 4 (level 3) to 3 (level 4)
  });

  it("leaves the ultimates (2 levels) and rows already long enough", () => {
    const ult = nova(2, [10, 20], [1, 1], [9, 9]);
    expect(spreadLevels(ult, 10)).toBe(ult);
    const ten = nova(10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(spreadLevels(ten, 10)).toBe(ten);
  });
});
