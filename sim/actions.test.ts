import { describe, expect, it } from "vitest";
import { EventKind } from "./events";
import { InputAction, NO_INPUT } from "./input";
import type { TickInput } from "./input";
import { stateHash } from "./hash";
import { abilityRun, addEnemy, eventsOf, quietData } from "./testing/ability-run";
import { gainXp } from "./level-up";
import type { Run } from "./run";
import { progressionRun } from "./testing/progression-run";

const R: TickInput = { ...NO_INPUT, actions: InputAction.Ultimate };
const T: TickInput = { ...NO_INPUT, actions: InputAction.ToggleAuto };
const SPACE = (moveX = 0, moveY = 0): TickInput => ({ moveX, moveY, card: -1, actions: InputAction.Dash });

function ultimateCasts(run: Run): number {
  return eventsOf(run, EventKind.Cast).filter((k) => run.events.a[k] === 3).length;
}

describe("ultimate key", () => {
  it("R casts a ready ultimate with auto off", () => {
    const run = abilityRun("stonehorn", { 3: 1 });
    run.ultimateAuto = false;
    run.step(NO_INPUT);
    expect(ultimateCasts(run)).toBe(0);
    run.step(R);
    expect(ultimateCasts(run)).toBe(1);
    expect(run.ultimateRequested).toBe(false);
  });

  it("R does nothing while the ultimate cools down or is unlearned", () => {
    const run = abilityRun("stonehorn", { 3: 1 });
    run.ultimateAuto = false;
    run.step(R);
    expect(ultimateCasts(run)).toBe(1);
    expect(run.abilities[3].cooldown).toBeGreaterThan(0);
    run.step(R);
    expect(ultimateCasts(run)).toBe(0);
    const unlearned = abilityRun("stonehorn", {});
    unlearned.ultimateAuto = false;
    unlearned.step(R);
    expect(ultimateCasts(unlearned)).toBe(0);
  });

  it("the request is not queued", () => {
    const run = abilityRun("stonehorn", { 3: 1 });
    run.ultimateAuto = false;
    run.step(R);
    run.step(R);
    const wait = run.abilities[3].cooldown;
    for (let i = 0; i < wait + 5; i++) {
      run.step(NO_INPUT);
      expect(ultimateCasts(run)).toBe(0);
    }
    const lvl = progressionRun();
    lvl.ultimateAuto = false;
    lvl.abilities[3].level = 1;
    gainXp(lvl, 4);
    lvl.step(NO_INPUT);
    expect(lvl.state).toBe("levelUp");
    lvl.step({ ...R, card: -1 });
    expect(lvl.ultimateRequested).toBe(false);
    lvl.step({ ...NO_INPUT, card: 0 });
    expect(lvl.state).toBe("playing");
    lvl.step(NO_INPUT);
    expect(ultimateCasts(lvl)).toBe(0);
  });

  it("T toggles auto", () => {
    const run = abilityRun("stonehorn", { 3: 1 });
    expect(run.ultimateAuto).toBe(true);
    run.step(T);
    expect(run.ultimateAuto).toBe(false);
    run.step(T);
    expect(run.ultimateAuto).toBe(true);
  });

  it("auto ultimate casts by itself", () => {
    const run = abilityRun("stonehorn", { 3: 1 });
    addEnemy(run, 100, 0);
    run.step(NO_INPUT);
    expect(ultimateCasts(run)).toBe(1);
  });
});

describe("dash", () => {
  const dash = quietData().rules.hero.dash;
  const ticks = Math.round(dash.seconds * 30);

  it("covers its distance in the move direction", () => {
    const run = abilityRun("stonehorn", {});
    run.step(SPACE(1, 0));
    expect(eventsOf(run, EventKind.Dash)).toHaveLength(1);
    const k = eventsOf(run, EventKind.Dash)[0];
    expect(run.events.a[k]).toBe(0);
    expect(run.events.value[k]).toBe(dash.distance);
    expect(run.events.x[k]).toBe(0);
    expect(run.events.y[k]).toBe(0);
    expect(run.events.u[k]).toBe(1);
    expect(run.events.v[k]).toBe(0);
    for (let i = 1; i < ticks; i++) run.step({ ...NO_INPUT, moveY: 1 });
    expect(run.hero.x).toBeCloseTo(dash.distance, 9);
    expect(run.hero.y).toBeCloseTo(0, 9);
    expect(run.hero.moving).toBe(true);
    run.step(NO_INPUT);
    expect(run.hero.x).toBeCloseTo(dash.distance, 9);
  });

  it("dash without input follows facing", () => {
    const run = abilityRun("stonehorn", {});
    run.hero.facingX = -1;
    run.hero.facingY = 0;
    run.step(SPACE());
    for (let i = 1; i < ticks; i++) run.step(NO_INPUT);
    expect(run.hero.x).toBeCloseTo(-dash.distance, 9);
    expect(run.hero.y).toBeCloseTo(0, 9);
  });

  it("dash waits for its cooldown", () => {
    const run = abilityRun("stonehorn", {});
    run.step(SPACE(1, 0));
    const cooldown = Math.round(dash.cooldownSeconds * 30);
    for (let s = 2; s <= cooldown; s++) {
      run.step(SPACE(1, 0));
      expect(eventsOf(run, EventKind.Dash)).toHaveLength(0);
    }
    run.step(SPACE(1, 0));
    expect(eventsOf(run, EventKind.Dash)).toHaveLength(1);
  });

  it("dash stays inside the arena", () => {
    const run = abilityRun("stonehorn", {});
    const limit = run.data.rules.arena.width / 2 - run.hero.stats.collision;
    run.hero.x = limit - 10;
    run.step(SPACE(1, 0));
    for (let i = 1; i < ticks; i++) run.step(NO_INPUT);
    expect(run.hero.x).toBe(limit);
  });

  it("a dead hero cannot dash and the actions in a levelUp state are dropped", () => {
    const run = abilityRun("stonehorn", {});
    run.hero.hp = 0;
    run.step(SPACE(1, 0));
    expect(eventsOf(run, EventKind.Dash)).toHaveLength(0);
    const lvl = progressionRun();
    gainXp(lvl, 4);
    lvl.step(NO_INPUT);
    const before = stateHash(lvl);
    lvl.step({ moveX: 1, moveY: 0, card: -1, actions: InputAction.Dash | InputAction.ToggleAuto });
    expect(stateHash(lvl)).toBe(before);
  });
});
