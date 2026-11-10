import { describe, expect, it } from "vitest";
import { Sfx } from "./sfx";
import { Throttle } from "./throttle";

describe("Throttle", () => {
  it("throttles bursts", () => {
    const throttle = new Throttle(4, 0.05);
    const passed = [0, 0.01, 0.02, 0.03, 0.04].filter((now) => throttle.allow("hit", now));
    expect(passed).toHaveLength(4);
  });

  it("allows again after the window", () => {
    const throttle = new Throttle(4, 0.05);
    for (let i = 0; i < 4; i++) throttle.allow("hit", 0.01 * i);
    expect(throttle.allow("hit", 0.04)).toBe(false);
    expect(throttle.allow("hit", 0.061)).toBe(true);
  });

  it("counts each sound on its own", () => {
    const throttle = new Throttle(1, 0.05);
    expect(throttle.allow("hit", 0)).toBe(true);
    expect(throttle.allow("cast", 0)).toBe(true);
    expect(throttle.allow("hit", 0.01)).toBe(false);
  });
});

describe("Sfx", () => {
  it("is silent without a context", () => {
    const sfx = new Sfx();
    expect(() => {
      sfx.hit();
      sfx.cast();
      sfx.death();
      sfx.pickup();
      sfx.levelUp();
      sfx.castleHit();
      sfx.setMuted(true);
    }).not.toThrow();
  });
});
