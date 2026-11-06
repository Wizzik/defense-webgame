import { describe, expect, it } from "vitest";
import { botInput } from "../../sim/bot";
import { createRun } from "../../sim/index";
import type { TickInput } from "../../sim/input";
import { gameData } from "../../sim/testing/game-data";
import { formatSummary } from "./run";

describe("formatSummary", () => {
  it("formats a lost run", () => {
    expect(
      formatSummary({
        seed: 1, result: "castle", seconds: 134, kills: 63, level: 7,
        castleHp: 0, castleMaxHp: 3000, heroHp: 812, heroMaxHp: 1555,
      }),
    ).toBe("seed 1: lost (castle) at 2:14, kills 63, level 7, castle 0/3000, hero 812/1555");
  });

  it("formats a won run", () => {
    expect(
      formatSummary({
        seed: 2, result: "won", seconds: 180, kills: 5, level: 2,
        castleHp: 10, castleMaxHp: 3000, heroHp: 1, heroMaxHp: 2,
      }),
    ).toBe("seed 2: won at 3:00, kills 5, level 2, castle 10/3000, hero 1/2");
  });
});

describe("bot run speed", () => {
  it("full run stays fast", () => {
    const run = createRun(gameData(), { seed: 1, durationSeconds: 180 });
    const input: TickInput = { moveX: 0, moveY: 0, card: -1 };
    const start = performance.now();
    let steps = 0;
    while (steps < 5400 && run.state !== "won" && run.state !== "lost") {
      botInput(run, input);
      run.step(input);
      steps++;
    }
    const elapsed = performance.now() - start;
    expect(steps).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);
  });
});
