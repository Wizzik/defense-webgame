import { describe, expect, it } from "vitest";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, addEnemy, eventsOf, quietData } from "../testing/ability-run";

function params(data: ReturnType<typeof quietData>) {
  const ab = data.abilities.find((a) => a.id === "grave-grasp");
  if (ab?.kind !== "area") throw new Error("test setup");
  return ab.params;
}

function spellHits(run: ReturnType<typeof abilityRun>): number[] {
  return eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 1).map((k) => run.events.a[k]);
}

describe("area", () => {
  it("strikes the densest cluster in range", () => {
    const run = abilityRun("gravecaller", { 0: 1 });
    const group = [addEnemy(run, 600, 0), addEnemy(run, 650, 30), addEnemy(run, 580, -40)];
    const lone = addEnemy(run, -200, 0);
    run.step(NO_INPUT);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts.length).toBe(1);
    expect(run.events.value[casts[0]]).toBe(params(quietData()).radius[0]);
    expect(spellHits(run).sort()).toEqual([...group].sort());
    expect(spellHits(run)).not.toContain(lone);
  });

  it("heals per hit up to max hp", () => {
    const data = quietData();
    const p = params(data);
    data.rules.hero.baseRegen = 0;
    data.rules.hero.regenPerStr = 0;
    const run = abilityRun("gravecaller", { 0: 1 }, data);
    for (let k = 0; k < 3; k++) addEnemy(run, 600 + k * 10, 0);
    run.hero.hp = 100;
    run.step(NO_INPUT);
    expect(run.hero.hp).toBeCloseTo(100 + 3 * p.healPerHit![0], 9);
    const heals = eventsOf(run, EventKind.Heal);
    expect(heals.length).toBe(1);
    expect(run.events.value[heals[0]]).toBeCloseTo(3 * p.healPerHit![0], 9);

    const near = abilityRun("gravecaller", { 0: 1 }, data);
    for (let k = 0; k < 3; k++) addEnemy(near, 600 + k * 10, 0);
    near.hero.hp = near.hero.stats.maxHp - 20;
    near.step(NO_INPUT);
    expect(near.hero.hp).toBeCloseTo(near.hero.stats.maxHp, 9);
    expect(near.events.value[eventsOf(near, EventKind.Heal)[0]]).toBeCloseTo(20, 9);
  });

  it("waits when nothing is in range", () => {
    const run = abilityRun("gravecaller", { 0: 1 });
    addEnemy(run, 0, 1500);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.abilities[0].cooldown).toBe(0);
  });
});
