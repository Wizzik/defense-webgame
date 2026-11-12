import { describe, expect, it } from "vitest";
import { damageEnemy } from "./combat";
import { updateEnemies } from "./enemy-ai";
import { Role } from "./enemies";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

function newRun() {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2000 }, heroStart: { x: 0, y: 1500 },
    spawn: { radius: 2000, spread: 150 },
  };
  data.rules.castle.radius = 180;
  data.rules.hero.collision = 32;
  silenceSpawns(data);
  data.rules.enemies.knockback = { attack: 40, ability: 90, seconds: 0.15 };
  data.enemies[0].moveSpeed = 0.0001;
  data.enemies[0].collision = 31;
  const run = createRun(data, { seed: 3, durationSeconds: 100000 });
  run.hero.x = 0;
  run.hero.y = 0;
  return run;
}

function spawn(run: ReturnType<typeof newRun>, x: number, y: number): number {
  return run.enemies.spawn(0, Role.Sieger, x, y, 1000, 1, 0);
}

function step(run: ReturnType<typeof newRun>): void {
  updateEnemies(run);
  run.tick++;
}

describe("knockback", () => {
  it("hit pushes the enemy away from the hero", () => {
    const run = newRun();
    const s = spawn(run, 300, 0);
    damageEnemy(run, s, 10, 0);
    expect(run.enemies.knockVX[s]).toBeGreaterThan(0);
    expect(run.enemies.knockVY[s]).toBeCloseTo(0, 9);
    step(run);
    expect(run.enemies.x[s]).toBeGreaterThan(300);
  });

  it("knockback fades to zero", () => {
    const run = newRun();
    const s = spawn(run, 300, 0);
    damageEnemy(run, s, 10, 0);
    const total = run.enemies.knockTicks[s];
    expect(total).toBe(5);
    const steps: number[] = [];
    for (let i = 0; i < total; i++) {
      const before = run.enemies.x[s];
      step(run);
      steps.push(run.enemies.x[s] - before);
    }
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
    expect(run.enemies.knockTicks[s]).toBe(0);
    const rest = run.enemies.x[s];
    step(run);
    expect(run.enemies.x[s]).toBeCloseTo(rest, 3);
  });

  it("knockback respects the arena and the castle", () => {
    const run = newRun();
    const edge = 3000 - 31;
    const a = spawn(run, edge - 1, 0);
    damageEnemy(run, a, 10, 1);
    for (let i = 0; i < 10; i++) step(run);
    expect(run.enemies.x[a]).toBeLessThanOrEqual(edge + 1e-9);

    // enemy just north of the castle, hero further north: the knock pushes it south into the castle
    run.hero.x = 0;
    run.hero.y = -1500;
    const c = spawn(run, 0, -2000 + 180 + 31 + 5);
    damageEnemy(run, c, 10, 1);
    expect(run.enemies.knockVY[c]).toBeLessThan(0);
    for (let i = 0; i < 10; i++) step(run);
    const dx = run.enemies.x[c] - run.castle.x;
    const dy = run.enemies.y[c] - run.castle.y;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(180 + 31 - 1e-6);
  });

  it("ability knocks harder than the base attack", () => {
    const run = newRun();
    const a = spawn(run, 300, 0);
    const b = spawn(run, 300, 500);
    run.hero.y = 500 - 0;
    run.hero.x = 0;
    damageEnemy(run, a, 10, 0);
    damageEnemy(run, b, 10, 1);
    expect(Math.abs(run.enemies.knockVX[b]) + Math.abs(run.enemies.knockVY[b])).toBeGreaterThan(
      Math.abs(run.enemies.knockVX[a]) + Math.abs(run.enemies.knockVY[a]),
    );
  });

  it("a boss is not knocked back", () => {
    const run = newRun();
    const boss = run.enemies.spawn(run.data.enemies.findIndex((e) => e.boss), Role.Sieger, 300, 0, 1000, 1, 0);
    damageEnemy(run, boss, 10, 1);
    expect(run.enemies.knockTicks[boss]).toBe(0);
    expect(run.enemies.knockVX[boss]).toBe(0);
  });
});
