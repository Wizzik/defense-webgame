import { describe, expect, it } from "vitest";
import { SpatialHash } from "./spatial-hash";

const POINTS = 1000;
const QUERIES = 50;
const CELL_SIZE = 2.4;

// mulberry32: small seeded RNG so the scenario is the same on every run
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPoints(seed: number): { xs: Float64Array; ys: Float64Array } {
  const random = rng(seed);
  const xs = new Float64Array(POINTS);
  const ys = new Float64Array(POINTS);
  for (let i = 0; i < POINTS; i++) {
    // negative coordinates included on purpose
    xs[i] = random() * 100 - 50;
    ys[i] = random() * 100 - 50;
  }
  return { xs, ys };
}

function fill(hash: SpatialHash, xs: Float64Array, ys: Float64Array): void {
  hash.clear();
  for (let i = 0; i < POINTS; i++) hash.insert(i, xs[i], ys[i]);
}

function bruteForce(xs: Float64Array, ys: Float64Array, x: number, y: number, radius: number): number[] {
  const found: number[] = [];
  for (let i = 0; i < POINTS; i++) {
    const dx = xs[i] - x;
    const dy = ys[i] - y;
    if (dx * dx + dy * dy <= radius * radius) found.push(i);
  }
  return found;
}

function internalArrays(hash: SpatialHash): unknown[] {
  return Object.values(hash).filter((value) => ArrayBuffer.isView(value));
}

describe("SpatialHash", () => {
  it("spatial hash returns exactly the brute-force neighbours", () => {
    const { xs, ys } = randomPoints(42);
    const hash = new SpatialHash(CELL_SIZE, POINTS);
    fill(hash, xs, ys);
    const random = rng(7);
    const out = new Int32Array(POINTS);
    let total = 0;
    for (let q = 0; q < QUERIES; q++) {
      const x = random() * 120 - 60;
      const y = random() * 120 - 60;
      const radius = 0.5 + random() * 7.5;
      const count = hash.query(x, y, radius, out);
      const found = Array.from(out.subarray(0, count)).sort((a, b) => a - b);
      expect(found).toEqual(bruteForce(xs, ys, x, y, radius));
      total += count;
    }
    // guard against a vacuous pass where every query is empty
    expect(total).toBeGreaterThan(QUERIES);
  });

  it("spatial hash keeps capacity", () => {
    const { xs, ys } = randomPoints(3);
    const hash = new SpatialHash(CELL_SIZE, POINTS);
    const before = internalArrays(hash);
    expect(before.length).toBeGreaterThan(0);
    for (let round = 0; round < 100; round++) fill(hash, xs, ys);
    const after = internalArrays(hash);
    expect(after).toHaveLength(before.length);
    after.forEach((array, i) => expect(array).toBe(before[i]));
    const out = new Int32Array(POINTS);
    expect(hash.query(0, 0, 5, out)).toBe(bruteForce(xs, ys, 0, 0, 5).length);
  });

  it("rejects inserts beyond capacity", () => {
    const hash = new SpatialHash(CELL_SIZE, 2);
    hash.insert(0, 0, 0);
    hash.insert(1, 1, 1);
    expect(() => hash.insert(2, 2, 2)).toThrow(/capacity/);
  });
});
