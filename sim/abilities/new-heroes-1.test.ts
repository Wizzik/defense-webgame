import { describe, expect, it } from "vitest";
import { armorReduction } from "../combat";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, addEnemy, eventsOf, quietData } from "../testing/ability-run";
import { AURA_SLOW_PERIOD } from "./aura-slow";

/** Base attack hits (source 0) of the current step. */
function attackHits(run: ReturnType<typeof abilityRun>): number[] {
  return eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 0);
}

/** Steps until the hero attacks; returns the base attack hits of that step. */
function untilAttack(run: ReturnType<typeof abilityRun>): number[] {
  for (let s = 0; s < 120; s++) {
    run.step(NO_INPUT);
    const hits = attackHits(run);
    if (hits.length > 0) return hits;
  }
  throw new Error("the hero never attacked");
}

describe("new heroes, batch 1: sim mechanics", () => {
  it("a critical strike (on_hit chance + multiplier) multiplies the base attack", () => {
    const data = quietData();
    const edge = data.abilities.find((a) => a.id === "keen-edge");
    if (!edge || edge.kind !== "on_hit") throw new Error("test setup");
    edge.params.chance = edge.params.chance!.map(() => 1);
    const run = abilityRun("razorwind", { 1: 1 }, data);
    const enemy = addEnemy(run, 40, 0);
    const hits = untilAttack(run);
    const main = hits.find((k) => run.events.a[k] === enemy)!;
    const reduction = armorReduction(data.enemies[0].armor, data.constants.defenseArmor);
    const mult = edge.params.multiplier![0]!;
    const stats = run.hero.stats;
    const v = run.events.value[main];
    expect(v).toBeGreaterThanOrEqual(Math.round(stats.damageMin) * mult * (1 - reduction) - 1e-6);
    expect(v).toBeLessThanOrEqual(Math.round(stats.damageMax) * mult * (1 - reduction) + 1e-6);
    // the proc is a cast with the multiplier as its value
    const casts = eventsOf(run, EventKind.Cast).filter((k) => run.events.a[k] === 1);
    expect(casts.length).toBe(1);
    expect(run.events.value[casts[0]!]).toBe(mult);
  });

  it("a critical strike that never procs leaves the attack as it is", () => {
    const data = quietData();
    const edge = data.abilities.find((a) => a.id === "keen-edge");
    if (!edge || edge.kind !== "on_hit") throw new Error("test setup");
    edge.params.chance = edge.params.chance!.map(() => 0);
    const run = abilityRun("razorwind", { 1: 1 }, data);
    addEnemy(run, 40, 0);
    const hits = untilAttack(run);
    const reduction = armorReduction(data.enemies[0].armor, data.constants.defenseArmor);
    expect(run.events.value[hits[0]!]).toBeLessThanOrEqual(Math.round(run.hero.stats.damageMax) * (1 - reduction) + 1e-6);
  });

  it("a cleave (on_hit splashRadius + splashPercent) hits the enemies around the target with its share", () => {
    const data = quietData();
    const blades = data.abilities.find((a) => a.id === "sweeping-blades");
    if (!blades || blades.kind !== "on_hit") throw new Error("test setup");
    const run = abilityRun("razorwind", { 0: 1 }, data);
    const target = addEnemy(run, 40, 0);
    const near = addEnemy(run, 40 + blades.params.splashRadius![0]! - 10, 0);
    const far = addEnemy(run, 40 + blades.params.splashRadius![0]! + 200, 0);
    const hits = untilAttack(run);
    const value = (enemy: number) => hits.filter((k) => run.events.a[k] === enemy).map((k) => run.events.value[k]);
    const [main] = value(target);
    expect(main).toBeGreaterThan(0);
    const [splash] = value(near);
    expect(splash).toBeCloseTo(main! * blades.params.splashPercent![0]!, 6);
    expect(value(far)).toEqual([]);
  });

  it("without the cleave learned nobody around the target is hit", () => {
    const run = abilityRun("razorwind", {});
    addEnemy(run, 40, 0);
    const near = addEnemy(run, 120, 0);
    const hits = untilAttack(run);
    expect(hits.filter((k) => run.events.a[k] === near)).toEqual([]);
  });

  it("an aura with slow (Chill Field) slows the enemies in its radius, not the ones outside", () => {
    const data = quietData();
    const field = data.abilities.find((a) => a.id === "chill-field");
    if (!field || field.kind !== "aura") throw new Error("test setup");
    const run = abilityRun("frostweaver", { 2: 2 }, data);
    const radius = field.params.radius![1]!;
    const inside = addEnemy(run, radius - 20, 0);
    const outside = addEnemy(run, 0, radius + 200);
    for (let s = 0; s < AURA_SLOW_PERIOD; s++) run.step(NO_INPUT);
    expect(run.enemies.slowFactor[inside]).toBeCloseTo(field.params.slow![1]!, 6);
    expect(run.enemies.slowTicks[inside]).toBeGreaterThan(0);
    expect(run.enemies.slowTicks[outside]).toBe(0);
  });

  it("Chill Field does nothing while it is not learned", () => {
    const run = abilityRun("frostweaver", {});
    const inside = addEnemy(run, 100, 0);
    for (let s = 0; s < AURA_SLOW_PERIOD * 2; s++) run.step(NO_INPUT);
    expect(run.enemies.slowTicks[inside]).toBe(0);
  });
});
