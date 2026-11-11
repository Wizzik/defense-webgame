import { describe, expect, it } from "vitest";
import { Role } from "./enemies";
import { Behavior, SKIRMISH_KEEP, SUPPORT_HOLD } from "./enemy-steer";
import { NO_INPUT } from "./input";
import { distance, enemyRun, heroDistance, heroHits, place, typeOf } from "./testing/enemy-run";

const step = (run: ReturnType<typeof enemyRun>, n = 1) => {
  for (let i = 0; i < n; i++) run.step(NO_INPUT);
};

describe("enemy behaviours", () => {
  it("every enemy type has its behaviour in the run", () => {
    const run = enemyRun();
    const of = (id: string) => run.enemyBehavior[typeOf(run, id)];
    expect(of("shieldbearer")).toBe(Behavior.Siege);
    expect(of("scout")).toBe(Behavior.Flank);
    expect(of("musketeer")).toBe(Behavior.Skirmish);
    expect(of("chaplain")).toBe(Behavior.Support);
    expect(of("lancer")).toBe(Behavior.Charge);
    expect(of("captain")).toBe(Behavior.Siege);
  });

  it("a flanker approaches at an angle", () => {
    const run = enemyRun();
    const even = place(run, "scout", Role.Hunter, 1500, 0);
    const odd = place(run, "scout", Role.Hunter, -1500, 0);
    expect(even % 2).toBe(0);
    expect(odd % 2).toBe(1);
    step(run, 30);
    const e = run.enemies;
    expect(heroDistance(run, even)).toBeLessThan(1500 - 200);
    expect(heroDistance(run, odd)).toBeLessThan(1500 - 200);
    // both start on the x axis: the offset from the straight line is |y|
    expect(Math.abs(e.y[even]!)).toBeGreaterThan(100);
    expect(Math.abs(e.y[odd]!)).toBeGreaterThan(100);
    // cross product of (direction to the hero) x (displacement): positive is left of the line
    const crossEven = -1 * e.y[even]!;
    const crossOdd = 1 * e.y[odd]!;
    expect(crossEven).toBeGreaterThan(0);
    expect(crossOdd).toBeLessThan(0);
  });

  it("a flanker reaches a standing hero", () => {
    const run = enemyRun();
    const scout = place(run, "scout", Role.Hunter, 2400, 0);
    let hitAt = -1;
    for (let i = 0; i < 360 && hitAt < 0; i++) {
      step(run);
      if (heroHits(run, scout) > 0) hitAt = i;
    }
    expect(hitAt).toBeGreaterThan(0);
  });

  it("a flanker hunts the hero even in a sieger pack", () => {
    const run = enemyRun();
    const scout = place(run, "scout", Role.Sieger, 1500, 0);
    const guard = place(run, "shieldbearer", Role.Sieger, 1500, 400);
    const { castle } = run;
    const guardBefore = distance(1500, 400, castle.x, castle.y);
    step(run, 30);
    expect(heroDistance(run, scout)).toBeLessThan(1500 - 200);
    expect(distance(run.enemies.x[guard]!, run.enemies.y[guard]!, castle.x, castle.y)).toBeLessThan(guardBefore - 200);
  });

  it("a skirmisher backs off while it reloads", () => {
    const run = enemyRun();
    const def = run.data.enemies[typeOf(run, "musketeer")]!;
    const reach = def.collision + run.hero.stats.collision + def.attack.range;
    const start = 0.3 * reach;
    expect(start).toBeGreaterThan(def.collision + run.hero.stats.collision);
    const m = place(run, "musketeer", Role.Hunter, start, 0);
    step(run);
    expect(heroHits(run, m)).toBe(1);
    let last = heroDistance(run, m);
    let backedOff = 0;
    while (run.enemies.attackCooldown[m]! > 1) {
      step(run);
      expect(heroHits(run, m)).toBe(0);
      const d = heroDistance(run, m);
      expect(d).toBeGreaterThanOrEqual(last - 1e-9);
      if (d > last + 1) backedOff++;
      last = d;
    }
    expect(backedOff).toBeGreaterThan(3);
    expect(last).toBeGreaterThanOrEqual(SKIRMISH_KEEP * reach - 1e-6);
    expect(last).toBeLessThan(reach);
    step(run, 3);
    expect(run.enemies.lastAttackTick[m]).toBeGreaterThan(1);
  });

  it("a skirmisher does not back off from the castle", () => {
    const run = enemyRun();
    const def = run.data.enemies[typeOf(run, "musketeer")]!;
    const { castle } = run;
    run.hero.x = 3000;
    run.hero.y = 3000;
    const x = castle.x + castle.radius + def.collision + 0.2 * def.attack.range;
    const m = place(run, "musketeer", Role.Sieger, x, castle.y);
    step(run);
    expect(run.castle.hp).toBeLessThan(1e9);
    step(run, 20);
    expect(run.enemies.x[m]).toBe(x);
    expect(run.enemies.y[m]).toBe(castle.y);
  });

  it("a support follows its nearest ally and holds behind it", () => {
    const run = enemyRun();
    run.hero.x = 3000;
    run.hero.y = 3000;
    const far = place(run, "shieldbearer", Role.Sieger, 0, -560);
    const near = place(run, "shieldbearer", Role.Sieger, 500, 0);
    run.enemies.stunTicks[far] = 1e6;
    run.enemies.stunTicks[near] = 1e6;
    const c = place(run, "chaplain", Role.Sieger, 0, 0);
    step(run, 60);
    const e = run.enemies;
    const d = distance(e.x[c]!, e.y[c]!, e.x[near]!, e.y[near]!);
    expect(d).toBeLessThanOrEqual(SUPPORT_HOLD);
    expect(d).toBeGreaterThan(SUPPORT_HOLD - 20);
    expect(Math.abs(e.y[c]!)).toBeLessThan(1);
    const x = e.x[c];
    step(run, 10);
    expect(e.x[c]).toBe(x);
  });

  it("a support flees a hero that comes close", () => {
    const run = enemyRun();
    place(run, "shieldbearer", Role.Sieger, 300, 0);
    run.enemies.stunTicks[0] = 1e6;
    const c = place(run, "chaplain", Role.Sieger, 200, 0);
    const before = heroDistance(run, c);
    step(run, 10);
    expect(heroDistance(run, c)).toBeGreaterThan(before + 50);
    expect(run.enemies.lastAttackTick[c]).toBe(-1);
  });

  it("a support without allies walks to its target", () => {
    const run = enemyRun();
    run.hero.x = 3000;
    run.hero.y = 3000;
    const { castle } = run;
    const a = place(run, "chaplain", Role.Sieger, 0, 0);
    const b = place(run, "chaplain", Role.Sieger, 200, 200); // another support is no ally to follow
    const before = distance(0, 0, castle.x, castle.y);
    step(run, 30);
    const e = run.enemies;
    const speed = run.data.enemies[typeOf(run, "chaplain")]!.moveSpeed;
    expect(distance(e.x[a]!, e.y[a]!, castle.x, castle.y)).toBeCloseTo(before - speed, 3);
    expect(distance(e.x[b]!, e.y[b]!, castle.x, castle.y)).toBeLessThan(distance(200, 200, castle.x, castle.y) - 200);
  });

  it("siege walks straight to its target", () => {
    const run = enemyRun();
    run.hero.x = 3000;
    run.hero.y = 3000;
    const { castle } = run;
    const s = place(run, "shieldbearer", Role.Sieger, 0, 0);
    step(run, 10);
    const speed = run.data.enemies[typeOf(run, "shieldbearer")]!.moveSpeed;
    const d = distance(0, 0, castle.x, castle.y);
    const moved = (speed * 10) / 30;
    expect(run.enemies.x[s]).toBeCloseTo((castle.x / d) * moved, 9);
    expect(run.enemies.y[s]).toBeCloseTo((castle.y / d) * moved, 9);
  });
});
