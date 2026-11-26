import { describe, expect, it } from "vitest";
import { EventKind } from "./events";
import { InputAction, NO_INPUT } from "./input";
import type { TickInput } from "./input";
import { maxDashCharges } from "./hero";
import { abilityRun, addEnemy, eventsOf, quietData } from "./testing/ability-run";

const SPACE: TickInput = { moveX: 1, moveY: 0, card: -1, actions: InputAction.Dash };
const blinkTo = (aimX: number, aimY: number): TickInput => ({ ...NO_INPUT, actions: InputAction.Blink, aimX, aimY });

describe("dash charges (rules.hero.dash.charges)", () => {
  const dash = quietData().rules.hero.dash;
  const dashTicks = Math.round(dash.seconds * 30);
  const cooldown = Math.round(dash.cooldownSeconds * 30);

  it("one charge before the level, three from it", () => {
    const run = abilityRun("stonehorn", {});
    expect(maxDashCharges(run)).toBe(1);
    run.hero.level = dash.charges.fromLevel;
    expect(maxDashCharges(run)).toBe(dash.charges.count);
  });

  it("three dashes in a row, then each charge comes back after one cooldown", () => {
    const run = abilityRun("stonehorn", {});
    run.hero.level = dash.charges.fromLevel;
    run.hero.dashCharges = 3;
    let dashes = 0;
    for (let d = 0; d < 4; d++) {
      run.step(SPACE);
      dashes += eventsOf(run, EventKind.Dash).length;
      for (let i = 1; i < dashTicks; i++) run.step(NO_INPUT);
    }
    expect(dashes).toBe(3);
    expect(run.hero.dashCharges).toBe(0);
    for (let i = 0; i < cooldown; i++) run.step(NO_INPUT);
    expect(run.hero.dashCharges).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 2 * cooldown; i++) run.step(NO_INPUT);
    expect(run.hero.dashCharges).toBe(3);
  });

  it("reaching the level fills the new charges over time", () => {
    const run = abilityRun("stonehorn", {});
    run.step(NO_INPUT);
    expect(run.hero.dashCharges).toBe(1);
    run.hero.level = dash.charges.fromLevel;
    for (let i = 0; i < 2 * cooldown + 2; i++) run.step(NO_INPUT);
    expect(run.hero.dashCharges).toBe(3);
  });
});

describe("blink (key F)", () => {
  const rule = quietData().rules.hero.blink;

  it("does nothing below its level", () => {
    const run = abilityRun("stonehorn", {});
    run.step(blinkTo(400, 0));
    expect(eventsOf(run, EventKind.Blink)).toHaveLength(0);
    expect(run.hero.x).toBeCloseTo(0, 6);
  });

  it("jumps to the aimed point and hurts and stuns the enemies there", () => {
    const run = abilityRun("stonehorn", {});
    run.hero.level = rule.fromLevel;
    const near = addEnemy(run, 500, 0);
    const far = addEnemy(run, 500 + rule.radius + 200, 0);
    const hpNear = run.enemies.hp[near]!;
    const hpFar = run.enemies.hp[far]!;
    run.step(blinkTo(400, 0));
    const k = eventsOf(run, EventKind.Blink);
    expect(k).toHaveLength(1);
    expect(run.events.a[k[0]!]).toBe(1);
    expect(run.hero.x).toBeGreaterThan(300);
    expect(run.enemies.hp[near]!).toBeLessThan(hpNear);
    expect(run.enemies.hp[far]!).toBe(hpFar);
  });

  it("reaches at most maxDistance and then waits for its cooldown", () => {
    const run = abilityRun("stonehorn", {});
    run.hero.level = rule.fromLevel;
    run.step(blinkTo(0, 5000));
    expect(run.hero.y).toBeLessThanOrEqual(rule.maxDistance + 1);
    expect(run.hero.y).toBeGreaterThan(rule.maxDistance - 50);
    const y = run.hero.y;
    run.step(blinkTo(0, 500));
    expect(eventsOf(run, EventKind.Blink)).toHaveLength(0);
    expect(run.hero.y).toBeCloseTo(y, 0);
    expect(run.hero.blinkCooldown).toBeGreaterThan(Math.round(rule.cooldownSeconds * 30) - 3);
  });
});
