import { describe, expect, it } from "vitest";
import { MAX_CATCH_UP, WallClock } from "./wall-clock";

describe("WallClock", () => {
  it("counts steps from the first call", () => {
    const clock = new WallClock(1000 / 30);
    expect(clock.due(5000)).toBe(0);
    expect(clock.due(5000 + 1000)).toBe(30);
    expect(clock.due(5000 + 200)).toBe(6);
  });

  it("catches up after a pause instead of dropping the time, in pieces", () => {
    const clock = new WallClock(1000 / 30);
    clock.due(0);
    // the window slept 10 s with 30 steps done: 270 are owed, paid MAX_CATCH_UP at a time
    expect(clock.pending(10_000, 30)).toBe(MAX_CATCH_UP);
    expect(clock.pending(10_000, 30 + 3 * MAX_CATCH_UP)).toBe(0);
    expect(clock.pending(10_000, 400)).toBe(0);
  });
});
