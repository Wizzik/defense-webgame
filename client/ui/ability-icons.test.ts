import { describe, expect, it } from "vitest";
import abilities from "../../data/generated/abilities.json";
import { abilityGlyph, abilityIconSvg, hasAbilityIcon } from "./ability-icons";

describe("ability icons", () => {
  it("every ability of the game has an icon of its own", () => {
    const glyphs = new Map<string, string>();
    for (const { id } of abilities) {
      expect(hasAbilityIcon(id), id).toBe(true);
      const glyph = abilityGlyph(id)!;
      expect(glyphs.get(glyph), `${id} shares its glyph`).toBeUndefined();
      glyphs.set(glyph, id);
    }
  });

  it("draws an icon in its colour, an unknown id as a plain diamond", () => {
    expect(abilityIconSvg("rock-rupture")).toContain('style="color:');
    expect(abilityIconSvg("nope")).toContain('M12 4l8 8-8 8-8-8z');
  });
});
