import { describe, expect, it } from "vitest";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, eventsOf, quietData } from "../testing/ability-run";

function setup() {
  const data = quietData();
  data.rules.hero.baseRegen = 0;
  data.rules.hero.regenPerStr = 0;
  const ab = data.abilities.find((a) => a.id === "mending-tide");
  if (!ab || ab.kind !== "heal") throw new Error("test setup");
  return { data, p: ab.params, run: abilityRun("serpent-shaman", { 2: 1 }, data) };
}

describe("heal", () => {
  it("heals below the threshold", () => {
    const { p, run } = setup();
    const max = run.hero.stats.maxHp;
    run.hero.hp = 0.5 * max;
    run.step(NO_INPUT);
    const expected = Math.min(max, 0.5 * max + p.amount[0] * run.hero.stats.spellPower);
    expect(run.hero.hp).toBeCloseTo(expected, 9);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts.length).toBe(1);
    expect(run.events.a[casts[0]]).toBe(2);
    expect(run.events.value[casts[0]]).toBeCloseTo(expected - 0.5 * max, 9);
    expect(run.events.x[casts[0]]).toBe(run.hero.x);
    expect(eventsOf(run, EventKind.Heal).length).toBe(1);
    expect(run.abilities[2].cooldown).toBeGreaterThan(0);
  });

  it("stays idle above the threshold", () => {
    const { data, run } = setup();
    const max = run.hero.stats.maxHp;
    run.hero.hp = (data.rules.autocast.healBelow + 0.05) * max;
    const hp = run.hero.hp;
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.hero.hp).toBe(hp);
  });

  it("heal does not revive a dead hero", () => {
    const { run } = setup();
    run.hero.hp = 0;
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.hero.hp).toBe(0);
    expect(run.result).toBe("hero");
  });
});
