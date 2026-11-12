import { describe, expect, it } from "vitest";
import { createRun, killEnemy, Role, spawnBoss } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { latestBoss, runPhase } from "./boss";

const typeOf = (id: string) => gameData().enemies.findIndex((e) => e.id === id);

describe("latestBoss", () => {
  it("is -1 without a living boss", () => {
    const run = createRun(gameData(), { seed: 1 });
    run.enemies.spawn(0, Role.Sieger, 0, 0, 10, 1, 0);
    expect(latestBoss(run)).toBe(-1);
  });

  it("is the living boss that came last", () => {
    const run = createRun(gameData(), { seed: 1 });
    const first = spawnBoss(run, typeOf("iron-marshal"), Role.Sieger);
    run.tick = 50;
    const second = spawnBoss(run, typeOf("pale-abbot"), Role.Sieger);
    expect(latestBoss(run)).toBe(second);
    killEnemy(run, second);
    expect(latestBoss(run)).toBe(first);
    killEnemy(run, first);
    expect(latestBoss(run)).toBe(-1);
  });
});

describe("runPhase", () => {
  it("counts phases from 1 and the finale is one past the last", () => {
    const run = createRun(gameData(), { seed: 1 });
    expect(runPhase(run)).toBe(1);
    run.tick = 50 * 30;
    expect(runPhase(run)).toBe(2);
    run.tick = run.durationTicks - 1;
    expect(runPhase(run)).toBe(20);
    run.tick = run.durationTicks;
    expect(runPhase(run)).toBe(21);
  });
});
