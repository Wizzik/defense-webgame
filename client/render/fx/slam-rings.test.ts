import { describe, expect, it } from "vitest";
import { ringFill } from "./slam-rings";

describe("slam rings", () => {
  it("ringFill is 0 at the start, 1 at the end and clamped", () => {
    expect(ringFill(0, 30)).toBe(0);
    expect(ringFill(15, 30)).toBe(0.5);
    expect(ringFill(30, 30)).toBe(1);
    expect(ringFill(45, 30)).toBe(1);
    expect(ringFill(-5, 30)).toBe(0);
  });

  it("a windup of no length is full at once", () => {
    expect(ringFill(0, 0)).toBe(1);
  });
});
