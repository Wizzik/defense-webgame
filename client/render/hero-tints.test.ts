import { describe, expect, it } from "vitest";
import heroes from "../../data/generated/heroes.json";
import { heroBodyColor, heroTint } from "./hero-tints";

describe("hero tints", () => {
  it("every hero has its own tint and body colour", () => {
    const first = heroes[0]!.id;
    const bodies = new Set<number>();
    const tints = new Set<number>();
    for (const hero of heroes) {
      if (hero.id !== first) {
        // an unknown hero falls back to the first hero's colours
        expect(heroTint(hero.id), hero.id).not.toBe(heroTint(first));
        expect(heroBodyColor(hero.id), hero.id).not.toBe(heroBodyColor(first));
      }
      bodies.add(heroBodyColor(hero.id));
      tints.add(heroTint(hero.id));
    }
    expect(heroes.length).toBe(8);
    expect(bodies.size).toBe(heroes.length);
    expect(tints.size).toBe(heroes.length);
  });
});
