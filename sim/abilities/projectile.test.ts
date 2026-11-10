import { describe, expect, it } from "vitest";
import { TICK_SECONDS } from "../constants";
import { killEnemy } from "../combat";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { PROJECTILE_CAPACITY } from "../projectiles";
import { abilityRun, addEnemy, eventsOf, quietData } from "../testing/ability-run";

const SLOT = 2; // the Gravecaller's soul bolt

function boltParams(data: ReturnType<typeof quietData>) {
  const ab = data.abilities.find((a) => a.id === "soul-bolt");
  if (!ab || ab.kind !== "projectile") throw new Error("test setup");
  return ab.params;
}

function spellHits(run: ReturnType<typeof abilityRun>): number[] {
  return eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 1);
}

describe("projectile", () => {
  it("bolt homes onto the nearest enemy", () => {
    const data = quietData();
    const p = boltParams(data);
    const run = abilityRun("gravecaller", { [SLOT]: 1 }, data);
    const target = addEnemy(run, 0, 1200);
    const step = (p.speed?.[0] ?? 1200) * TICK_SECONDS;
    const collision = run.data.enemies[0].collision;
    const expected = Math.ceil((1200 - step - collision) / step) + 1;
    let hitStep = -1;
    for (let n = 1; n <= expected + 5 && hitStep < 0; n++) {
      run.step(NO_INPUT);
      if (n === 1) {
        const casts = eventsOf(run, EventKind.Cast);
        expect(casts.length).toBe(1);
        const k = casts[0];
        expect(run.events.a[k]).toBe(SLOT);
        expect(run.events.value[k]).toBe(0);
        expect(run.events.x[k]).toBe(run.hero.x);
        expect(run.events.y[k]).toBe(run.hero.y);
        expect(run.events.u[k]).toBeCloseTo(0, 9);
        expect(run.events.v[k]).toBeCloseTo(1, 9);
      }
      const hits = spellHits(run);
      if (hits.length > 0) {
        hitStep = n;
        expect(run.events.a[hits[0]]).toBe(target);
        expect(run.events.value[hits[0]]).toBeCloseTo(p.damage[0] * run.hero.stats.spellPower, 9);
      }
    }
    expect(hitStep).toBeGreaterThanOrEqual(expected - 1);
    expect(hitStep).toBeLessThanOrEqual(expected + 1);
    expect(run.projectiles.count).toBe(0);
  });

  it("bolt retargets when its target dies", () => {
    const run = abilityRun("gravecaller", { [SLOT]: 1 });
    const first = addEnemy(run, 0, 1200);
    const second = addEnemy(run, 0, 1400);
    for (let n = 0; n < 20; n++) run.step(NO_INPUT);
    expect(run.projectiles.count).toBe(1);
    killEnemy(run, first);
    const bx = run.projectiles.x[0];
    const by = run.projectiles.y[0];
    run.enemies.x[second] = bx + 300;
    run.enemies.y[second] = by;
    let hit = -1;
    for (let n = 0; n < 40 && hit < 0; n++) {
      run.step(NO_INPUT);
      const hits = spellHits(run);
      if (hits.length > 0) hit = run.events.a[hits[0]];
    }
    expect(hit).toBe(second);
    expect(run.projectiles.count).toBe(0);
  });

  it("bolt fizzles without a target nearby", () => {
    const run = abilityRun("gravecaller", { [SLOT]: 1 });
    const first = addEnemy(run, 0, 1200);
    addEnemy(run, 0, -2000);
    for (let n = 0; n < 10; n++) run.step(NO_INPUT);
    expect(run.projectiles.count).toBe(1);
    killEnemy(run, first);
    for (let n = 0; n < 5; n++) {
      run.step(NO_INPUT);
      expect(spellHits(run).length).toBe(0);
    }
    expect(run.projectiles.count).toBe(0);
  });

  it("full projectile store waits", () => {
    const run = abilityRun("gravecaller", { [SLOT]: 1 });
    const target = addEnemy(run, 0, 1200);
    for (let i = 0; i < PROJECTILE_CAPACITY; i++) {
      run.projectiles.spawn(0, target, run.enemies.spawnTick[target], run.hero.x, run.hero.y, 0, 0);
    }
    expect(run.projectiles.count).toBe(PROJECTILE_CAPACITY);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.abilities[SLOT].cooldown).toBe(0);
    expect(run.projectiles.count).toBe(PROJECTILE_CAPACITY);
  });

  it("prev positions follow the flight", () => {
    const run = abilityRun("gravecaller", { [SLOT]: 1 });
    addEnemy(run, 0, 1200);
    run.step(NO_INPUT);
    run.step(NO_INPUT);
    expect(run.projectiles.count).toBe(1);
    expect(run.projectiles.prevY[0]).toBeLessThan(run.projectiles.y[0]);
  });
});
