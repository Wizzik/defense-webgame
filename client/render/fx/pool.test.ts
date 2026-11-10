import { describe, expect, it } from "vitest";
import { FxPool } from "./pool";

describe("FxPool", () => {
  it("reuses the oldest entry when full", () => {
    const pool = new FxPool(3, 1);
    const a = pool.add(0);
    const b = pool.add(0.1);
    const c = pool.add(0.2);
    expect(new Set([a, b, c]).size).toBe(3);
    const d = pool.add(0.3);
    expect(d).toBe(a);
    expect(pool.age(a, 0.3)).toBeCloseTo(0);
    expect(pool.age(b, 0.3)).toBeCloseTo(0.2);
  });

  it("entries expire after their life", () => {
    const pool = new FxPool(4, 0.4);
    const i = pool.add(1);
    expect(pool.age(i, 1)).toBe(0);
    expect(pool.age(i, 1.25)).toBeCloseTo(0.25);
    expect(pool.age(i, 1.4)).toBeCloseTo(0.4);
    expect(pool.age(i, 1.41)).toBe(-1);
  });

  it("an empty entry has no age", () => {
    const pool = new FxPool(2, 1);
    expect(pool.age(0, 0)).toBe(-1);
    expect(pool.age(1, 5)).toBe(-1);
  });

  it("reset empties the pool", () => {
    const pool = new FxPool(2, 1);
    const i = pool.add(0);
    pool.add(0);
    pool.reset();
    expect(pool.age(i, 0.1)).toBe(-1);
    expect(pool.add(0)).toBe(0);
  });
});
