import { describe, expect, it } from "vitest";
import { stateHash } from "./hash";
import type { TickInput } from "./input";
import { Rng } from "./rng";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

function play(seed: number, inputSeed: number, steps: number): number {
  const run = createRun(gameData(), { seed });
  const inputs = new Rng(inputSeed);
  const input: TickInput = { moveX: 0, moveY: 0, card: -1 };
  for (let i = 0; i < steps; i++) {
    input.moveX = inputs.int(3) - 1;
    input.moveY = inputs.int(3) - 1;
    run.step(input);
  }
  return stateHash(run);
}

describe("stateHash", () => {
  it("same seed and inputs give the same hash", () => {
    expect(play(5, 99, 600)).toBe(play(5, 99, 600));
  });

  it("different inputs give a different hash", () => {
    expect(play(5, 99, 600)).not.toBe(play(5, 100, 600));
  });
});
