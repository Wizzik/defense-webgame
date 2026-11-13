import { describe, expect, it } from "vitest";
import { COIN_CAPACITY, debugGrantGold, updatePickups } from "./crystals";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { progressionRun } from "./testing/progression-run";

type TestRun = ReturnType<typeof progressionRun>;

/** A run whose hero kills the enemy next to it with one blow; the enemy type 0 drops `gold`. */
function killRun(gold: number): TestRun {
  const run = progressionRun();
  run.data.enemies[0]!.gold = gold;
  run.data.enemies[0]!.xp = 1;
  // Far crystals and coins stay where they fall.
  run.data.rules.progression.magnetRadius = 10;
  run.enemies.spawn(0, Role.Hunter, run.hero.x + 100, run.hero.y, 1, 1, 0);
  run.hero.stats.damageMin = 500;
  run.hero.stats.damageMax = 500;
  return run;
}

function pickups(run: TestRun): { value: number; kind: number }[] {
  const out: { value: number; kind: number }[] = [];
  for (let k = 0; k < run.events.count; k++) {
    if (run.events.kind[k] === EventKind.Pickup) out.push({ value: run.events.value[k]!, kind: run.events.u[k]! });
  }
  return out;
}

describe("gold", () => {
  it("a killed enemy drops a coin of its gold, 24 units east of the crystal", () => {
    const run = killRun(2);
    run.step(NO_INPUT);
    expect(run.stats.kills).toBe(1);
    expect(run.coins.count).toBe(1);
    expect(run.coins.value[0]).toBe(2);
    expect(run.coins.x[0]).toBe(run.crystals.x[0]! + 24);
    expect(run.coins.y[0]).toBe(run.crystals.y[0]);
    expect(run.gold).toBe(0);
    expect(COIN_CAPACITY).toBe(512);
  });

  it("an enemy without gold drops no coin", () => {
    const run = killRun(0);
    run.step(NO_INPUT);
    expect(run.stats.kills).toBe(1);
    expect(run.crystals.count).toBe(1);
    expect(run.coins.count).toBe(0);
  });

  it("a collected coin gives its gold times (1 + goldFind) and a Pickup event of kind 1", () => {
    const run = progressionRun();
    run.hero.gear.goldFind = 0.3;
    run.coins.drop(run.hero.x + 20, run.hero.y, 2);
    run.crystals.drop(run.hero.x - 20, run.hero.y, 1);
    run.step(NO_INPUT);
    expect(run.coins.count).toBe(0);
    expect(run.gold).toBe(Math.round(2 * 1.3));
    expect(run.stats.goldGained).toBe(3);
    expect(run.hero.xp).toBe(1);
    expect(pickups(run).sort((a, b) => a.kind - b.kind)).toEqual([{ value: 1, kind: 0 }, { value: 3, kind: 1 }]);
  });

  it("coins fly to the hero from the magnet reach, gear magnet included", () => {
    const run = progressionRun();
    const reach = run.data.rules.progression.magnetRadius;
    run.hero.gear.magnet = 50;
    const near = run.coins.drop(run.hero.x + reach + 40, run.hero.y, 1);
    const far = run.coins.drop(run.hero.x + reach + 60, run.hero.y, 1);
    updatePickups(run, run.coins, 1);
    expect(run.coins.attracted[near]).toBe(1);
    expect(run.coins.attracted[far]).toBe(0);
  });

  it("gold goes straight to the hero when the coin store is full", () => {
    const run = killRun(2);
    for (let i = 0; i < COIN_CAPACITY; i++) run.coins.drop(2500, 2000, 1);
    run.step(NO_INPUT);
    expect(run.coins.count).toBe(COIN_CAPACITY);
    expect(run.gold).toBe(2);
    expect(run.stats.goldGained).toBe(2);
  });

  it("the hash covers gold and coins", () => {
    const a = progressionRun();
    const b = progressionRun();
    expect(stateHash(a)).toBe(stateHash(b));
    debugGrantGold(b, 5);
    expect(b.gold).toBe(5);
    expect(b.stats.goldGained).toBe(5);
    expect(stateHash(a)).not.toBe(stateHash(b));
    debugGrantGold(a, 5);
    expect(stateHash(a)).toBe(stateHash(b));
    b.coins.drop(900, 900, 1);
    expect(stateHash(a)).not.toBe(stateHash(b));
  });

  it("coins keep their previous position for the renderer", () => {
    const run = progressionRun();
    const slot = run.coins.drop(run.hero.x + 200, run.hero.y, 1);
    run.step(NO_INPUT);
    expect(run.coins.prevX[slot]).toBe(run.hero.x + 200);
    expect(run.coins.x[slot]).toBeLessThan(run.hero.x + 200);
    run.step(NO_INPUT);
    expect(run.coins.prevX[slot]).toBeLessThan(run.hero.x + 200);
  });
});
