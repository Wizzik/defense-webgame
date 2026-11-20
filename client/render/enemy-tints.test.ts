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

  it("no tint of a common type has an orange hue (20-45 degrees)", () => {
    for (const e of enemies.filter((x) => !("boss" in x))) {
      const hex = enemyTint(e.id);
      const r = ((hex >> 16) & 0xff) / 255;
      const g = ((hex >> 8) & 0xff) / 255;
      const b = (hex & 0xff) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 0.08) continue; // grey: no hue
      let hue = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
      hue = (hue * 60 + 360) % 360;
      expect(hue >= 20 && hue <= 45, `${e.id}: hue ${hue.toFixed(0)}`).toBe(false);
    }
  });

  it("each faction keeps to its palette family", () => {
    const hueOf = (hex: number) => {
      const r = ((hex >> 16) & 0xff) / 255;
      const g = ((hex >> 8) & 0xff) / 255;
      const b = (hex & 0xff) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 0.08) return -1;
      const h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
      return (h * 60 + 360) % 360;
    };
    const family: Record<string, [number, number]> = { orc: [46, 160], undead: [50, 160], elf: [170, 290], human: [190, 250] };
    for (const e of enemies as { id: string; faction?: string }[]) {
      if (e.faction === undefined) continue;
      const hue = hueOf(enemyTint(e.id));
      if (hue < 0) continue;
      const [lo, hi] = family[e.faction]!;
      expect(hue >= lo && hue <= hi, `${e.id} (${e.faction}): hue ${hue.toFixed(0)}`).toBe(true);
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
