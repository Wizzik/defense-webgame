import { describe, expect, it } from "vitest";
import { Action, Role } from "./enemies";
import { EventKind } from "./events";
import { updateEnemies } from "./enemy-ai";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

function newRun() {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2000 }, heroStart: { x: 0, y: 1500 },
    gates: [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }], gateRadius: 150,
  };
  data.rules.castle.radius = 180;
  data.rules.hero.collision = 32;
  data.rules.enemies.siegerAggroRange = 250;
  data.rules.enemies.leashRange = 900;
  data.rules.phases[0].spawnPerSecond = 0;
  data.constants.defenseArmor = 0.02;
  const e = data.enemies[0];
  e.moveSpeed = 270;
  e.collision = 31;
  e.attack = { range: 90, cooldown: 1.35, damageMin: 14, damageMax: 15 };
  return createRun(data, { seed: 3, durationSeconds: 100000 });
}

function dist(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function add(run: ReturnType<typeof newRun>, role: number, x: number, y: number): number {
  return run.enemies.spawn(0, role, 0, x, y, 420, 1, 0);
}

function tickAI(run: ReturnType<typeof newRun>): void {
  updateEnemies(run);
  run.tick++;
}

describe("enemy AI", () => {
  it("siegers walk to the castle and attack it", () => {
    const run = newRun();
    const s = add(run, Role.Sieger, 0, -2000 + 400);
    run.hero.x = 2500;
    run.hero.y = 2000;
    let first = -1;
    let hitIndex = -1;
    for (let i = 0; i < 120 && first < 0; i++) {
      tickAI(run);
      for (let k = 0; k < run.events.count; k++) {
        if (run.events.kind[k] === EventKind.CastleHit) {
          first = run.events.value[k];
          hitIndex = k;
        }
      }
      run.events.clear();
    }
    expect(run.events.a[hitIndex]).toBe(s);
    expect(run.events.x[hitIndex]).toBe(run.enemies.x[s]);
    expect(run.events.y[hitIndex]).toBe(run.enemies.y[s]);
    expect(first === 14 || first === 15).toBe(true);
    expect(run.enemies.action[s]).toBe(Action.Attack);
    expect(run.castle.hp).toBe(run.castle.maxHp - first);
    expect(run.castle.lastHitTick).toBeGreaterThan(0);
  });

  it("sieger aggroes when the hero comes close", () => {
    const run = newRun();
    const s = add(run, Role.Sieger, 0, 0);
    run.hero.x = 200;
    run.hero.y = 0;
    tickAI(run);
    expect(run.enemies.aggro[s]).toBe(1);
    expect(run.enemies.facingX[s]).toBeGreaterThan(0.9);
  });

  it("sieger leashes back beyond leashRange", () => {
    const run = newRun();
    const s = add(run, Role.Sieger, 0, 0);
    run.enemies.aggro[s] = 1;
    run.hero.x = 1000;
    run.hero.y = 0;
    tickAI(run);
    expect(run.enemies.aggro[s]).toBe(0);
    expect(run.enemies.facingY[s]).toBeLessThan(-0.9);
  });

  it("hunters chase the hero", () => {
    const run = newRun();
    const h = add(run, Role.Hunter, 0, 0);
    run.hero.x = 1000;
    run.hero.y = 0;
    tickAI(run);
    expect(1000 - run.enemies.x[h]).toBeCloseTo(1000 - 270 / 30, 6);
    expect(run.enemies.action[h]).toBe(Action.Move);
  });

  it("stunned enemies neither move nor attack", () => {
    const run = newRun();
    const h = add(run, Role.Hunter, 0, 0);
    run.hero.x = 400;
    run.hero.y = 0;
    run.enemies.stunTicks[h] = 3;
    for (let i = 0; i < 3; i++) {
      tickAI(run);
      expect(run.enemies.action[h]).toBe(Action.Stunned);
      expect(run.enemies.x[h]).toBe(0);
    }
    expect(run.events.count).toBe(0);
    tickAI(run);
    expect(run.enemies.action[h]).toBe(Action.Move);
    expect(run.enemies.x[h]).toBeGreaterThan(0);
  });

  it("enemies keep apart", () => {
    const run = newRun();
    const a = add(run, Role.Sieger, 500, 0);
    const b = add(run, Role.Sieger, 500, 0);
    run.hero.x = 2500;
    run.hero.y = 2000;
    for (let i = 0; i < 30; i++) tickAI(run);
    const d = dist(run.enemies.x[a] - run.enemies.x[b], run.enemies.y[a] - run.enemies.y[b]);
    expect(d).toBeGreaterThan(40);
  });

  it("enemies do not overlap the hero or the castle", () => {
    const run = newRun();
    const h = add(run, Role.Hunter, 0, 0);
    const s = add(run, Role.Sieger, 0, -2000 + 250);
    run.hero.x = 0;
    run.hero.y = 0;
    run.hero.prevX = 0;
    for (let i = 0; i < 60; i++) tickAI(run);
    const e = run.enemies;
    expect(dist(e.x[h] - run.hero.x, e.y[h] - run.hero.y)).toBeGreaterThanOrEqual(32 + 31 - 1e-6);
    expect(dist(e.x[s] - run.castle.x, e.y[s] - run.castle.y)).toBeGreaterThanOrEqual(180 + 31 - 1e-6);
  });

  it("enemy damage to the hero uses the hero armor", () => {
    const run = newRun();
    add(run, Role.Hunter, 0, 0);
    run.hero.x = 50;
    run.hero.y = 0;
    run.hero.stats.armor = 7; // 7 * 0.02 = 0.14
    const before = run.hero.hp;
    tickAI(run);
    expect(run.events.kind[0]).toBe(EventKind.HeroHit);
    expect(run.events.a[0]).toBe(0);
    expect(run.events.value[0]).toBeCloseTo(before - run.hero.hp, 9);
    expect(run.events.x[0]).toBe(50);
    expect(run.events.y[0]).toBe(0);
    const dealt = before - run.hero.hp;
    const f = 1 - 0.14 / 1.14;
    expect(dealt).toBeGreaterThanOrEqual(14 * f - 1e-9);
    expect(dealt).toBeLessThanOrEqual(15 * f + 1e-9);
  });
});
