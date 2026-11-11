import { describe, expect, it } from "vitest";
import enemies from "../../data/generated/enemies.json";
import { ENEMY_TINTS, enemyTint, tintTable } from "./enemy-tints";

describe("enemy tints", () => {
  it("every enemy type has its own tint", () => {
    const tints = enemies.map((e) => {
      expect(Object.keys(ENEMY_TINTS), e.id).toContain(e.id);
      return enemyTint(e.id);
    });
    expect(new Set(tints).size).toBe(enemies.length);
  });

  it("unknown id falls back to red", () => {
    expect(enemyTint("ghost")).toBe(0xc23b3b);
  });

  it("no tint is orange", () => {
    // orange: red clearly above green, green clearly above blue
    for (const [id, hex] of Object.entries(ENEMY_TINTS)) {
      const r = (hex >> 16) & 0xff;
      const g = (hex >> 8) & 0xff;
      const b = hex & 0xff;
      expect(r > 200 && g > 90 && g < 180 && b < 90, id).toBe(false);
    }
  });

  it("tintTable holds linear rgb per type, in type order", () => {
    const table = tintTable([{ id: "chaplain" }, { id: "ghost" }]);
    expect(table).toHaveLength(6);
    // 0xe6e6f2: bright and slightly blue
    expect(table[0]).toBeCloseTo(table[1]!, 6);
    expect(table[2]).toBeGreaterThan(table[0]!);
    expect(table[0]).toBeGreaterThan(0.7);
    // the fallback red: red far above green and blue
    expect(table[3]).toBeGreaterThan(table[4]! * 5);
    expect(table[4]).toBeCloseTo(table[5]!, 6);
  });
});
