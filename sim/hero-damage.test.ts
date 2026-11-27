import { describe, expect, it } from "vitest";
import { damageCastle, damageHero, heroDamageScale } from "./combat";
import { EventKind } from "./events";
import { abilityRun, eventsOf } from "./testing/ability-run";

describe("damage taken by the hero", () => {
  it("an enemy hit on a ranged hero counts twice", () => {
    const run = abilityRun("nightglaive", {});
    const hp = run.hero.hp;
    damageHero(run, 100, -1);
    expect(hp - run.hero.hp).toBeCloseTo(200, 9);
    expect(run.events.value[eventsOf(run, EventKind.HeroHit)[0]!]).toBeCloseTo(200, 9);
    expect(heroDamageScale(run)).toBe(2);
  });

  it("stonehorn and redcleaver take half (melee fighters, Petr's batch 2)", () => {
    for (const id of ["stonehorn", "redcleaver"]) {
      const run = abilityRun(id, {});
      const hp = run.hero.hp;
      damageHero(run, 100, -1);
      expect(hp - run.hero.hp).toBeCloseTo(100, 9);
      expect(heroDamageScale(run)).toBe(1);
    }
  });

  it("the shield still blocks the doubled hit", () => {
    const run = abilityRun("nightglaive", {});
    run.shieldTicks = 5;
    const hp = run.hero.hp;
    damageHero(run, 100, -1);
    expect(run.hero.hp).toBe(hp);
    expect(eventsOf(run, EventKind.HeroHit)).toHaveLength(0);
  });

  it("the castle takes a hit as before", () => {
    const run = abilityRun("nightglaive", {});
    const hp = run.castle.hp;
    damageCastle(run, 100, -1);
    expect(hp - run.castle.hp).toBe(100);
  });
});
