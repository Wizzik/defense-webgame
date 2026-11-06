import { describe, expect, it } from "vitest";
import { Role } from "./enemies";
import { NO_INPUT } from "./input";
import { createRun } from "./run";
import { spawnEnemies } from "./spawner";
import { gameData } from "./testing/game-data";

function newRun(tweak?: (d: ReturnType<typeof gameData>) => void, seed = 1) {
  const data = gameData();
  data.rules.arena.gates = [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }];
  data.rules.arena.gateRadius = 150;
  data.rules.run.phaseSeconds = 50;
  data.rules.run.timeScaling = { seconds: 1200, cap: 2 };
  data.rules.enemies.maxAlive = 150;
  data.rules.phases[0].spawnPerSecond = 0.45;
  data.rules.phases[0].hunterShare = 0.2;
  tweak?.(data);
  return createRun(data, { seed, durationSeconds: 100000 });
}

/** Spawner only: nobody moves, so counts stay exact. */
function spawnOnly(run: ReturnType<typeof newRun>, steps: number): void {
  for (let i = 0; i < steps; i++) {
    spawnEnemies(run);
    run.tick++;
  }
}

describe("spawner", () => {
  it("spawns at the phase rate", () => {
    const run = newRun();
    run.abilities[0].cooldown = 1_000_000;
    for (let i = 0; i < 610; i++) run.step(NO_INPUT);
    // The hero may kill some of them, so count the spawns.
    expect(run.stats.spawned).toBe(9);
  });

  it("counts every spawned enemy in the run stats", () => {
    const run = newRun();
    expect(run.stats.spawned).toBe(0);
    spawnOnly(run, 200);
    expect(run.stats.spawned).toBe(run.enemies.aliveCount);
    expect(run.stats.spawned).toBeGreaterThan(0);
  });

  it("alternates gates", () => {
    const run = newRun();
    spawnOnly(run, 200);
    expect(run.enemies.gate[0]).toBe(0);
    expect(run.enemies.gate[1]).toBe(1);
    expect(run.enemies.x[0]).toBeLessThan(0);
    expect(run.enemies.x[1]).toBeGreaterThan(0);
    expect(Math.abs(run.enemies.y[0] - 2200)).toBeLessThanOrEqual(150);
  });

  it("phase changes after phaseSeconds", () => {
    const run = newRun();
    spawnOnly(run, 1499);
    expect(run.phaseIndex).toBe(0);
    spawnOnly(run, 1);
    expect(run.phaseIndex).toBe(1);
  });

  it("hunter share follows the phase", () => {
    const run = newRun((d) => {
      d.rules.phases[0].spawnPerSecond = 30;
      d.rules.phases[0].hunterShare = 0.25;
    });
    spawnOnly(run, 150);
    expect(run.enemies.aliveCount).toBe(150);
    let hunters = 0;
    for (let i = 0; i < 150; i++) if (run.enemies.role[i] === Role.Hunter) hunters++;
    expect(hunters / 150).toBeGreaterThanOrEqual(0.15);
    expect(hunters / 150).toBeLessThanOrEqual(0.35);
  });

  it("respects maxAlive without a burst", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 5;
      d.rules.phases[0].spawnPerSecond = 3;
    });
    spawnOnly(run, 100);
    expect(run.enemies.aliveCount).toBe(5);
    run.enemies.kill(2);
    spawnOnly(run, 1);
    expect(run.enemies.aliveCount).toBe(5);
    spawnOnly(run, 1);
    expect(run.enemies.aliveCount).toBe(5);
  });

  it("scales hp with time", () => {
    const run = newRun((d) => {
      d.rules.enemies.maxAlive = 5;
      for (const p of d.rules.phases) p.spawnPerSecond = 30;
    });
    run.tick = 600 * 30;
    run.spawnCredit = 0;
    spawnEnemies(run);
    expect(run.enemies.hp[0]).toBeCloseTo(run.data.enemies[0].hp * 1.5, 6);
    expect(run.enemies.damageScale[0]).toBeCloseTo(1.5, 6);
  });

  it("same seed spawns at the same positions", () => {
    const a = newRun(undefined, 7);
    const b = newRun(undefined, 7);
    const c = newRun(undefined, 8);
    spawnOnly(a, 900);
    spawnOnly(b, 900);
    spawnOnly(c, 900);
    expect(a.enemies.aliveCount).toBeGreaterThan(5);
    expect(Array.from(a.enemies.x)).toEqual(Array.from(b.enemies.x));
    expect(Array.from(a.enemies.y)).toEqual(Array.from(b.enemies.y));
    expect(Array.from(a.enemies.x)).not.toEqual(Array.from(c.enemies.x));
  });
});
