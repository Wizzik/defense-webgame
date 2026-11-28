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
    const e = addEnemy(run, 150, 0);
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

  it("stuns the enemies it hits for stunSeconds (new heroes, batch 2)", () => {
    const data = quietData();
    const p = novaParams(data, "skull-ring");
    p.stunSeconds = p.damage.map(() => 2);
    p.damage = p.damage.map(() => 1);
    const run = abilityRun("gravecaller", { 1: 1 }, data);
    const e = addEnemy(run, 150, 0);
    run.enemies.stunTicks[e] = 0; // addEnemy holds the enemy in place with a long stun
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(1);
    expect(run.enemies.stunTicks[e]).toBeGreaterThanOrEqual(59);
    expect(run.enemies.stunTicks[e]).toBeLessThanOrEqual(60);
  });

  it("does not stun without stunSeconds", () => {
    const data = quietData();
    const p = novaParams(data, "skull-ring");
    p.damage = p.damage.map(() => 1);
    const run = abilityRun("gravecaller", { 1: 1 }, data);
    const e = addEnemy(run, 150, 0);
    run.enemies.stunTicks[e] = 0; // addEnemy holds the enemy in place with a long stun
    run.step(NO_INPUT);
    expect(run.enemies.stunTicks[e]).toBe(0);
  });

  it("waits for novaMinEnemies", () => {
    const data = quietData();
    data.rules.autocast.novaMinEnemies = 3;
    const run = abilityRun("gravecaller", { 1: 1 }, data);
    addEnemy(run, 150, 0);
    addEnemy(run, 0, 150);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.abilities[1].cooldown).toBe(0);
    addEnemy(run, -150, 0);
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

  it("falling stars (an area since batch 2) slow for slowSeconds", () => {
    const data = quietData();
    const ab = data.abilities.find((a) => a.id === "falling-stars");
    if (!ab || ab.kind !== "area") throw new Error("test setup");
    const p = ab.params;
    p.radius = p.radius.map(() => 400); // room for the enemy to walk while slowed
    const run = abilityRun("nightglaive", { 0: 1 }, data);
    const e = addEnemy(run, 0, 350);
    run.enemies.stunTicks[e] = 0;
    run.enemies.role[e] = 1;
    const speed = run.data.enemies[0].moveSpeed;
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(1);
    const slowSteps = Math.round(p.slowSeconds![0] * 30);
    const moved = (): number => {
      const x = run.enemies.x[e];
      const y = run.enemies.y[e];
      run.step(NO_INPUT);
      return Math.sqrt((x - run.enemies.x[e]) * (x - run.enemies.x[e]) + (y - run.enemies.y[e]) * (y - run.enemies.y[e]));
    };
    for (let k = 0; k < slowSteps; k++) expect(moved()).toBeCloseTo((1 - p.slow![0]) * speed / 30, 9);
    expect(moved()).toBeCloseTo(speed / 30, 9);
  });
});
