import { describe, expect, it } from "vitest";
import { heroDamageScale, HeroHitSource } from "./combat";
import { EventKind } from "./events";
import { Role } from "./enemies";
import { NO_INPUT } from "./input";
import { enemyRun, place, type EnemyRun } from "./testing/enemy-run";

function cloudRun() {
  const run = enemyRun();
  run.hero.x = 0;
  run.hero.y = 0;
  run.hero.stats.regenPerSecond = 0;
  return run;
}

/** A rotgut that neither walks nor hits (stunned): only its cloud acts. */
function rotgut(run: EnemyRun, x: number, y: number, id = "rotgut"): number {
  const slot = place(run, id, Role.Sieger, x, y);
  run.enemies.stunTicks[slot] = 1e6;
  return slot;
}

function steps(run: EnemyRun, n: number): void {
  for (let i = 0; i < n; i++) run.step(NO_INPUT);
}

describe("poison cloud", () => {
  it("the hero 100 from a rotgut loses 0.01 x max hp x the damage scale in 30 steps", () => {
    const run = cloudRun();
    rotgut(run, 100, 0);
    const maxHp = run.hero.stats.maxHp;
    steps(run, 30);
    expect(run.stats.cloudDamage).toBeCloseTo(0.01 * maxHp * heroDamageScale(run), 3);
    const hit = run.events.kind.subarray(0, run.events.count).indexOf(EventKind.HeroHit);
    expect(run.events.u[hit]).toBe(HeroHitSource.Cloud);
  });

  it("two clouds over the hero hurt like one", () => {
    const run = cloudRun();
    rotgut(run, 100, 0);
    rotgut(run, -100, 0);
    steps(run, 30);
    expect(run.stats.cloudDamage).toBeCloseTo(0.01 * run.hero.stats.maxHp * heroDamageScale(run), 3);
  });

  it("300 from a rotgut the hero is outside; the bone tyrant's cloud reaches 350", () => {
    const run = cloudRun();
    rotgut(run, 300, 0);
    steps(run, 30);
    expect(run.stats.cloudDamage).toBe(0);
    rotgut(run, 0, 330, "bone-tyrant");
    steps(run, 1);
    expect(run.stats.cloudDamage).toBeGreaterThan(0);
  });

  it("the Spirit Ward shield keeps the cloud off", () => {
    const run = cloudRun();
    rotgut(run, 100, 0);
    run.shieldTicks = 1000;
    const hp = run.hero.hp;
    steps(run, 30);
    expect(run.stats.cloudDamage).toBe(0);
    expect(run.hero.hp).toBe(hp);
  });

  it("the castle in a cloud takes nothing", () => {
    const run = cloudRun();
    const { castle } = run;
    rotgut(run, castle.x + castle.radius + 50, castle.y);
    const hp = castle.hp;
    steps(run, 30);
    expect(castle.hp).toBe(hp);
  });
});
