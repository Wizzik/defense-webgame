import { describe, expect, it } from "vitest";
import { killEnemy } from "./combat";
import { debugDropHeart, HEART_CAPACITY, updatePickups } from "./crystals";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { abilityRun, eventsOf, quietData } from "./testing/ability-run";

function run(chance?: number) {
  const data = quietData();
  if (chance !== undefined) data.rules.sustain.hearts.chance = chance;
  return abilityRun("stonehorn", {}, data);
}

type R = ReturnType<typeof run>;

function spawn(r: R, type: number, dx = 400, dy = 0): number {
  return r.enemies.spawn(type, Role.Hunter, r.hero.x + dx, r.hero.y + dy, 100, 1, 0);
}

function commonType(r: R): number {
  return r.data.enemies.findIndex((e, i) => !e.boss && r.isElite[i] === 0);
}

describe("hearts", () => {
  it("an elite and a boss always drop a heart", () => {
    const r = run(1e-9);
    killEnemy(r, spawn(r, r.eliteTypes[0]!));
    expect(r.hearts.count).toBe(1);
    killEnemy(r, spawn(r, r.isBoss.indexOf(1)));
    expect(r.hearts.count).toBe(2);
  });

  it("a common enemy drops with its chance from sustainRng only", () => {
    const always = run(1);
    const before = always.rng.state;
    for (let i = 0; i < 5; i++) killEnemy(always, spawn(always, commonType(always), 400 + i * 10));
    expect(always.hearts.count).toBe(5);
    expect(always.rng.state).toBe(before);
    const never = run(1e-9);
    for (let i = 0; i < 5; i++) killEnemy(never, spawn(never, commonType(never), 400 + i * 10));
    expect(never.hearts.count).toBe(0);
  });

  it("a heart sits west of the crystal", () => {
    const r = run(1);
    const slot = spawn(r, commonType(r), 400, 50);
    killEnemy(r, slot);
    const heart = r.hearts.alive.indexOf(1);
    expect(r.hearts.x[heart]).toBe(r.hero.x + 400 - 24);
    expect(r.hearts.y[heart]).toBe(r.hero.y + 50);
  });

  it("a heart heals 8 % of max hp, never above max", () => {
    const r = run();
    const max = r.hero.stats.maxHp;
    r.hero.hp = max / 2;
    r.hearts.drop(r.hero.x, r.hero.y, 1);
    r.events.clear();
    updatePickups(r, r.hearts, 2);
    expect(r.hero.hp).toBeCloseTo(max / 2 + 0.08 * max, 9);
    const pickups = eventsOf(r, EventKind.Pickup);
    expect(pickups.length).toBe(1);
    expect(r.events.u[pickups[0]!]).toBe(2);
    expect(r.events.value[pickups[0]!]).toBeCloseTo(0.08 * max, 9);
    expect(r.stats.hearts).toBe(1);
    expect(r.stats.healedHearts).toBeCloseTo(0.08 * max, 9);
    r.hero.hp = max * 0.99;
    r.hearts.drop(r.hero.x, r.hero.y, 1);
    updatePickups(r, r.hearts, 2);
    expect(r.hero.hp).toBe(max);
    expect(r.stats.hearts).toBe(2);
  });

  it("a full heart store drops the heart, no heal", () => {
    const r = run();
    for (let i = 0; i < HEART_CAPACITY; i++) r.hearts.drop(r.hero.x + 2000, r.hero.y, 1);
    r.hero.hp = r.hero.stats.maxHp / 2;
    killEnemy(r, spawn(r, r.eliteTypes[0]!));
    expect(r.hearts.count).toBe(HEART_CAPACITY);
    expect(r.hero.hp).toBe(r.hero.stats.maxHp / 2);
  });

  it("a heart does not revive a fallen hero", () => {
    const r = run();
    r.hero.hp = -5;
    r.hearts.drop(r.hero.x, r.hero.y, 1);
    r.step(NO_INPUT);
    expect(r.hero.hp).toBeLessThanOrEqual(0);
    expect(r.state).toBe("lost");
    expect(r.hearts.count).toBe(0);
  });

  it("debugDropHeart puts a heart 100 ahead of the hero", () => {
    const r = run();
    debugDropHeart(r);
    const heart = r.hearts.alive.indexOf(1);
    expect(r.hearts.x[heart]).toBeCloseTo(r.hero.x + r.hero.facingX * 100, 9);
    expect(r.hearts.y[heart]).toBeCloseTo(r.hero.y + r.hero.facingY * 100, 9);
  });
});
