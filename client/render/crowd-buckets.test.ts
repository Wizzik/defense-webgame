import { describe, expect, it } from "vitest";
import { CrowdBuckets } from "./crowd-buckets";

describe("CrowdBuckets", () => {
  it("counts per type and returns the index within the type", () => {
    const buckets = new CrowdBuckets(6, 150);
    const indices = [buckets.push(2), buckets.push(2), buckets.push(2), buckets.push(0)];
    expect(indices).toEqual([0, 1, 2, 0]);
    expect(buckets.count(2)).toBe(3);
    expect(buckets.count(0)).toBe(1);
    expect(buckets.count(1)).toBe(0);
  });

  it("holds `capacity` instances of one type and throws on the next", () => {
    const buckets = new CrowdBuckets(6, 150);
    for (let i = 0; i < 150; i++) buckets.push(4);
    expect(buckets.count(4)).toBe(150);
    expect(() => buckets.push(4)).toThrow();
  });

  it("reset zeroes every count", () => {
    const buckets = new CrowdBuckets(3, 10);
    buckets.push(0);
    buckets.push(1);
    buckets.push(2);
    buckets.reset();
    expect([buckets.count(0), buckets.count(1), buckets.count(2)]).toEqual([0, 0, 0]);
    expect(buckets.push(1)).toBe(0);
  });
});
