import { describe, expect, it } from "vitest";
import { Rng } from "./rng";
import * as dir from "./spawn-direction";

describe("spawn direction", () => {
  it("randomDirection gives unit vectors", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 1000; i++) {
      dir.randomDirection(rng);
      expect(Math.abs(Math.sqrt(dir.dirX * dir.dirX + dir.dirY * dir.dirY) - 1)).toBeLessThan(1e-9);
    }
  });

  it("directions cover all four quadrants", () => {
    const rng = new Rng(4);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      dir.randomDirection(rng);
      seen.add(`${dir.dirX > 0}${dir.dirY > 0}`);
    }
    expect(seen.size).toBe(4);
  });

  it("rotatedDirection for two packs is the opposite", () => {
    dir.rotatedDirection(0.6, 0.8, 1, 2);
    expect(dir.dirX).toBeCloseTo(-0.6, 12);
    expect(dir.dirY).toBeCloseTo(-0.8, 12);
    dir.rotatedDirection(0.6, 0.8, 0, 2);
    expect(dir.dirX).toBe(0.6);
    expect(dir.dirY).toBe(0.8);
  });

  it("for three packs the directions are 120° apart", () => {
    const v: [number, number][] = [];
    for (let k = 0; k < 3; k++) {
      dir.rotatedDirection(0.6, 0.8, k, 3);
      v.push([dir.dirX, dir.dirY]);
    }
    for (let k = 0; k < 3; k++) {
      const a = v[k]!;
      const b = v[(k + 1) % 3]!;
      expect(Math.abs(a[0] * b[0] + a[1] * b[1] + 0.5)).toBeLessThan(1e-9);
      expect(Math.abs(Math.sqrt(a[0] * a[0] + a[1] * a[1]) - 1)).toBeLessThan(1e-9);
    }
  });

  it("count 1 keeps the direction", () => {
    dir.rotatedDirection(0.6, 0.8, 0, 1);
    expect([dir.dirX, dir.dirY]).toEqual([0.6, 0.8]);
  });
});
