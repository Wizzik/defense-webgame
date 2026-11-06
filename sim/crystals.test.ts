import { describe, expect, it } from "vitest";
import { CRYSTAL_CAPACITY, CrystalStore } from "./crystals";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { progressionRun } from "./testing/progression-run";

function events(run: ReturnType<typeof progressionRun>, kind: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === kind) out.push(k);
  return out;
}

describe("crystals", () => {
  it("drop takes the lowest free slot and reports a full store", () => {
    const store = new CrystalStore(2);
    expect(store.drop(1, 2, 3)).toBe(0);
    expect(store.drop(1, 2, 3)).toBe(1);
    expect(store.drop(1, 2, 3)).toBe(-1);
    store.collect(0);
    expect(store.count).toBe(1);
    expect(store.drop(5, 6, 7)).toBe(0);
    expect(CRYSTAL_CAPACITY).toBe(512);
  });

  it("killed enemies drop crystals", () => {
    const run = progressionRun();
    run.data.enemies[0].xp = 3;
    run.enemies.spawn(0, Role.Hunter, 0, run.hero.x + 100, run.hero.y, 1, 1, 0);
    run.hero.stats.damageMin = 500;
    run.hero.stats.damageMax = 500;
    run.step(NO_INPUT);
    expect(run.stats.kills).toBe(1);
    expect(run.crystals.count).toBe(1);
    expect(run.crystals.value[0]).toBe(3);
    expect(run.crystals.x[0]).toBeGreaterThan(0);
    expect(run.crystals.x[0]).toBeLessThanOrEqual(100);
  });

  it("magnet pulls crystals and pickup gives xp", () => {
    const run = progressionRun();
    run.crystals.drop(run.hero.x + 400, run.hero.y, 3);
    run.crystals.drop(run.hero.x + 250, run.hero.y, 2);
    run.step(NO_INPUT);
    expect(run.crystals.attracted[0]).toBe(0);
    expect(run.crystals.x[0]).toBe(400);
    expect(run.crystals.attracted[1]).toBe(1);
    expect(run.crystals.x[1]).toBeCloseTo(250 - 30, 9);
    expect(run.crystals.prevX[1]).toBe(250);
    let picked = 0;
    for (let i = 0; i < 40; i++) {
      run.step(NO_INPUT);
      for (const k of events(run, EventKind.Pickup)) {
        picked++;
        expect(run.events.value[k]).toBeGreaterThan(0);
      }
    }
    expect(picked).toBe(1);
    expect(run.crystals.count).toBe(1);
    expect(run.hero.xp).toBe(2);
    expect(run.crystals.alive[1]).toBe(0);
  });

  it("a fast crystal does not fly past the hero", () => {
    const run = progressionRun();
    run.data.rules.progression.crystalSpeed = 100000;
    run.data.rules.progression.pickupRadius = 1;
    run.crystals.drop(run.hero.x + 200, run.hero.y, 1);
    run.step(NO_INPUT);
    expect(run.crystals.count).toBe(0);
    expect(run.hero.xp).toBe(1);
  });

  it("full crystal store gives xp directly", () => {
    const run = progressionRun();
    for (let i = 0; i < CRYSTAL_CAPACITY; i++) run.crystals.drop(2500, 2000, 1);
    run.data.enemies[0].xp = 3;
    run.enemies.spawn(0, Role.Hunter, 0, run.hero.x + 100, run.hero.y, 1, 1, 0);
    run.hero.stats.damageMin = 500;
    run.hero.stats.damageMax = 500;
    run.step(NO_INPUT);
    expect(run.stats.kills).toBe(1);
    expect(run.crystals.count).toBe(CRYSTAL_CAPACITY);
    expect(run.hero.xp).toBe(3);
  });
});
