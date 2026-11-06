import { describe, expect, it } from "vitest";
import { Rng } from "./rng";

// Reference: the generator of the phase-0 spike.
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Rng", () => {
  it("same seed gives the same sequence", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("int stays in range", () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 10000; i++) {
      const n = rng.int(7);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect(seen.size).toBe(7);
  });

  it("matches the spike generator", () => {
    const rng = new Rng(1);
    const reference = createRandom(1);
    for (let i = 0; i < 3; i++) expect(rng.next()).toBe(reference());
  });
});
