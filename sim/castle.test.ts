import { describe, expect, it } from "vitest";
import { regenCastle } from "./castle";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

function newRun() {
  const data = gameData();
  data.rules.castle.hp = 3000;
  data.rules.castle.regenPercentPerMinute = 2;
  return createRun(data, { seed: 1, durationSeconds: 100000 });
}

describe("castle", () => {
  it("castle regenerates 2 % per minute", () => {
    const run = newRun();
    run.castle.hp = 1000;
    for (let i = 0; i < 1800; i++) regenCastle(run);
    expect(run.castle.hp).toBeCloseTo(1060, 2);
  });

  it("castle does not regenerate above max or at 0 hp", () => {
    const run = newRun();
    regenCastle(run);
    expect(run.castle.hp).toBe(3000);
    run.castle.hp = 0;
    regenCastle(run);
    expect(run.castle.hp).toBe(0);
  });

  it("castle at 0 hp loses the run", () => {
    const run = newRun();
    run.castle.hp = 0;
    run.step(NO_INPUT);
    expect(run.result).toBe("castle");
    expect(run.state).toBe("lost");
    const last = run.events.count - 1;
    expect(run.events.kind[last]).toBe(EventKind.RunEnd);
    expect(run.events.a[last]).toBe(1);
  });
});
