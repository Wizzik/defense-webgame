import { describe, expect, it } from "vitest";
import { DamageNumberPool, NUMBER_LIFE } from "./damage-number-pool";

describe("damage numbers", () => {
  it("reuse the oldest slot", () => {
    const pool = new DamageNumberPool(3);
    const a = pool.add(0.0);
    const b = pool.add(0.1);
    const c = pool.add(0.2);
    expect(new Set([a, b, c]).size).toBe(3);
    // all busy: the oldest (a) is overwritten
    expect(pool.add(0.3)).toBe(a);
    expect(pool.add(0.4)).toBe(b);
  });

  it("expire after 0.6 s", () => {
    const pool = new DamageNumberPool(2);
    const a = pool.add(1);
    expect(NUMBER_LIFE).toBe(0.6);
    expect(pool.age(a, 1.3)).toBeCloseTo(0.3, 9);
    expect(pool.active(a, 1.59)).toBe(true);
    expect(pool.active(a, 1.61)).toBe(false);
    // an expired slot is free again and preferred over overwriting a live one
    const b = pool.add(1.5);
    expect(pool.add(1.7)).toBe(a);
    expect(pool.active(b, 1.7)).toBe(true);
  });
});
