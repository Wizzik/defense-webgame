import { describe, expect, it } from "vitest";
import { HealWindow } from "./heal-window";

describe("heal window", () => {
  it("sums heals and gives the sum once the window has passed", () => {
    const w = new HealWindow(0.5);
    w.add(3, 1.0);
    w.add(4.6, 1.2);
    expect(w.take(1.3)).toBe(0);
    expect(w.take(1.5)).toBe(7.6);
    expect(w.take(1.6)).toBe(0);
  });

  it("drops sums under one hp and starts the window at the first heal", () => {
    const w = new HealWindow(0.5);
    w.add(0.4, 2);
    expect(w.take(2.6)).toBe(0);
    w.add(5, 10);
    expect(w.take(10.4)).toBe(0);
    expect(w.take(10.5)).toBe(5);
  });

  it("clears", () => {
    const w = new HealWindow(0.5);
    w.add(5, 1);
    w.clear();
    expect(w.take(9)).toBe(0);
  });
});
