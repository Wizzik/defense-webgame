import { describe, expect, it } from "vitest";
import { viewTiming } from "./view-timing";

describe("viewTiming", () => {
  it("passes the loop values through while playing", () => {
    expect(viewTiming("playing", 0.4, 0.016)).toEqual({ alpha: 0.4, dt: 0.016 });
  });

  it("freezes the scene in every other state", () => {
    for (const state of ["levelUp", "won", "lost"]) {
      expect(viewTiming(state, 0.4, 0.016)).toEqual({ alpha: 1, dt: 0 });
    }
  });
});
