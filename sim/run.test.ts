import { describe, expect, it } from "vitest";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

function newRun(durationSeconds = 100) {
  const data = gameData();
  data.rules.arena.width = 6000;
  data.rules.arena.height = 5000;
  data.rules.arena.heroStart = { x: 0, y: 0 };
  data.rules.arena.castle = { x: 0, y: -2000 };
  data.rules.hero.collision = 32;
  return createRun(data, { seed: 1, durationSeconds });
}

describe("gameData", () => {
  it("returns independent copies", () => {
    const a = gameData();
    a.rules.hero.collision = 1;
    expect(gameData().rules.hero.collision).not.toBe(1);
  });
});

describe("Run", () => {
  it("hero moves north at move speed", () => {
    const run = newRun();
    for (let i = 0; i < 30; i++) run.step({ moveX: 0, moveY: 1, card: -1 });
    expect(run.hero.y).toBeCloseTo(300, 6);
    expect(run.hero.x).toBe(0);
    expect(run.hero.moving).toBe(true);
    expect(run.hero.facingY).toBe(1);
  });

  it("diagonal speed is normalized", () => {
    const run = newRun();
    for (let i = 0; i < 30; i++) run.step({ moveX: 1, moveY: 1, card: -1 });
    expect(run.hero.x).toBeCloseTo(300 / Math.SQRT2, 6);
    expect(run.hero.y).toBeCloseTo(300 / Math.SQRT2, 6);
  });

  it("hero stays inside the arena", () => {
    const run = newRun(1000);
    for (let i = 0; i < 600; i++) run.step({ moveX: 1, moveY: 1, card: -1 });
    expect(run.hero.x).toBe(3000 - 32);
    expect(run.hero.y).toBe(2500 - 32);
    for (let i = 0; i < 900; i++) run.step({ moveX: -1, moveY: -1, card: -1 });
    expect(run.hero.x).toBe(-(3000 - 32));
    expect(run.hero.y).toBe(-(2500 - 32));
  });

  it("run is won when the duration ends", () => {
    const run = newRun(2);
    for (let i = 0; i < 59; i++) run.step(NO_INPUT);
    expect(run.state).toBe("playing");
    run.step(NO_INPUT);
    expect(run.state).toBe("won");
    expect(run.result).toBe("won");
    expect(run.tick).toBe(60);
    expect(run.events.count).toBe(1);
    expect(run.events.kind[0]).toBe(EventKind.RunEnd);
    expect(run.events.a[0]).toBe(0);
  });

  it("step after the end does nothing", () => {
    const run = newRun(1);
    for (let i = 0; i < 30; i++) run.step(NO_INPUT);
    const before = stateHash(run);
    run.step({ moveX: 1, moveY: 1, card: -1 });
    expect(stateHash(run)).toBe(before);
    expect(run.tick).toBe(30);
  });

  it("saves previous positions for interpolation", () => {
    const run = newRun();
    run.step({ moveX: 0, moveY: 1, card: -1 });
    run.step({ moveX: 0, moveY: 1, card: -1 });
    expect(run.hero.prevY).toBeCloseTo(10, 6);
    expect(run.hero.y).toBeCloseTo(20, 6);
  });
});
