import { describe, expect, it } from "vitest";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, addEnemy, eventsOf, quietData } from "../testing/ability-run";

function novaParams(data: ReturnType<typeof quietData>, id: string) {
  const ab = data.abilities.find((a) => a.id === id);
  if (!ab || ab.kind !== "nova") throw new Error("test setup");
  return ab.params;
}

describe("nova", () => {
  it("casts when enemies are inside the radius", () => {
    const data = quietData();
    const p = novaParams(data, "skull-ring");
    const run = abilityRun("gravecaller", { 1: 1 }, data);
    const e = addEnemy(run, 300, 0);
    run.step(NO_INPUT);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts.length).toBe(1);
    expect(run.events.a[casts[0]]).toBe(1);
    expect(run.events.value[casts[0]]).toBe(p.radius[0]);
    const hits = eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 1); // spell hits only
    expect(hits.length).toBe(1);
    expect(run.events.value[hits[0]]).toBeCloseTo(p.damage[0] * run.hero.stats.spellPower, 9);
    expect(run.events.a[hits[0]]).toBe(e);
  });

  it("waits for novaMinEnemies", () => {
    const data = quietData();
    data.rules.autocast.novaMinEnemies = 3;
    const run = abilityRun("gravecaller", { 1: 1 }, data);
    addEnemy(run, 300, 0);
    addEnemy(run, 0, 300);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.abilities[1].cooldown).toBe(0);
    addEnemy(run, -300, 0);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(1);
  });

  it("forced cast ignores targeting", () => {
    const run = abilityRun("stonehorn", { 3: 1 });
    run.ultimateRequested = true;
    run.step(NO_INPUT);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts.length).toBe(1);
    expect(run.events.a[casts[0]]).toBe(3);
  });

  it("slows for slowSeconds", () => {
    const data = quietData();
    const p = novaParams(data, "falling-stars");
    const run = abilityRun("nightglaive", { 0: 1 }, data);
    const e = addEnemy(run, 0, 350);
    run.enemies.stunTicks[e] = 0;
    run.enemies.role[e] = 1;
    const speed = run.data.enemies[0].moveSpeed;
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(1);
    const slowSteps = Math.round(p.slowSeconds![0] * 30);
    for (let k = 0; k < slowSteps; k++) {
      const before = run.enemies.y[e];
      run.step(NO_INPUT);
      expect(before - run.enemies.y[e]).toBeCloseTo((1 - p.slow![0]) * speed / 30, 9);
    }
    const before = run.enemies.y[e];
    run.step(NO_INPUT);
    expect(before - run.enemies.y[e]).toBeCloseTo(speed / 30, 9);
  });
});
