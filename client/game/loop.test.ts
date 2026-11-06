import { describe, expect, it } from "vitest";
import { FixedStepLoop } from "./loop";

const STEP = 1 / 30;

describe("FixedStepLoop", () => {
  it("caps steps per frame", () => {
    const loop = new FixedStepLoop(STEP, 4);
    expect(loop.advance(2.0, 1)).toBe(4);
    expect(loop.alpha).toBe(0);
  });

  it("accumulates partial steps", () => {
    const loop = new FixedStepLoop(STEP, 4);
    let steps = 0;
    for (let i = 0; i < 10; i++) steps += loop.advance(0.021, 1);
    expect(steps).toBe(6);
  });

  it("speed multiplies steps", () => {
    const loop = new FixedStepLoop(STEP, 4);
    expect(loop.advance(0.11, 4)).toBe(13);
  });
});
