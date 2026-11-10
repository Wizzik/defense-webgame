import { describe, expect, it } from "vitest";
import { Role } from "../enemies";
import { createRun } from "../run";
import { gameData } from "../testing/game-data";
import { countEnemiesWithin, densestCluster, nearestEnemy } from "./targeting";

function newRun() {
  const data = gameData();
  data.enemies[0].collision = 30;
  return createRun(data, { seed: 1 });
}

function add(run: ReturnType<typeof newRun>, x: number, y: number): number {
  return run.enemies.spawn(0, Role.Hunter, 0, x, y, 100, 1, 0);
}

describe("targeting", () => {
  it("nearestEnemy breaks ties by the lower slot", () => {
    const run = newRun();
    const a = add(run, 100, 0);
    const b = add(run, -100, 0);
    add(run, 500, 0);
    expect(Math.min(a, b)).toBe(a);
    expect(nearestEnemy(run, 0, 0, 800)).toBe(a);
    expect(nearestEnemy(run, 0, 0, 50)).toBe(-1);
  });

  it("densestCluster picks the bigger group", () => {
    const run = newRun();
    const small = [add(run, -300, 0), add(run, -350, 0)];
    const big = [add(run, 500, 0), add(run, 550, 0), add(run, 450, 0)];
    expect(small.length).toBeLessThan(big.length);
    const pick = densestCluster(run, 0, 0, 800, 300);
    expect(big).toContain(pick);
  });

  it("densestCluster ignores enemies beyond range", () => {
    const run = newRun();
    const near = add(run, 100, 0);
    add(run, 1500, 0);
    add(run, 1520, 0);
    add(run, 1540, 0);
    expect(densestCluster(run, 0, 0, 800, 300)).toBe(near);
    expect(densestCluster(run, 0, 0, 50, 300)).toBe(-1);
  });

  it("countEnemiesWithin counts the collision", () => {
    const run = newRun();
    const c = run.data.enemies[0].collision;
    add(run, 200 + c, 0);
    add(run, 200 + c + 1, 0);
    expect(countEnemiesWithin(run, 0, 0, 200)).toBe(1);
    expect(countEnemiesWithin(run, 0, 0, 201)).toBe(2);
  });
});
