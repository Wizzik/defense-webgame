import { describe, expect, it } from "vitest";
import items from "../../data/generated/items.json";
import loot from "../../data/generated/loot.json";
import { STAT_IDS } from "../../data/schema";
import { hasStatIcon, statColor, statGlyph, statIconSvg } from "./stat-icons";

describe("stat icons", () => {
  it("every stat has a glyph and a colour of its own", () => {
    const glyphs = new Map<string, string>();
    const colors = new Map<string, string>();
    for (const stat of STAT_IDS) {
      expect(hasStatIcon(stat), stat).toBe(true);
      const glyph = statGlyph(stat)!;
      expect(glyphs.get(glyph), `${stat} shares its glyph`).toBeUndefined();
      glyphs.set(glyph, stat);
      const color = statColor(stat);
      expect(colors.get(color), `${stat} shares its colour`).toBeUndefined();
      colors.set(color, stat);
    }
  });

  it("covers every stat of the random items and the named items", () => {
    const stats = new Set<string>();
    for (const affix of loot.affixes) stats.add(affix.stat);
    for (const base of loot.bases) stats.add(base.implicit.stat);
    for (const item of items) for (const row of item.stats) stats.add(row.stat);
    for (const stat of stats) expect(hasStatIcon(stat), stat).toBe(true);
  });

  it("draws an icon in its colour, an unknown stat as a plain diamond", () => {
    expect(statIconSvg("armor")).toContain('style="color:#c3ccd6"');
    expect(statIconSvg("nope")).toContain("M12 4l8 8-8 8-8-8z");
  });
});
