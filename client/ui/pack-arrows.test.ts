import { describe, expect, it } from "vitest";
import { arrowPlacement } from "./pack-arrows";

describe("pack arrows", () => {
  it("arrowPlacement points east for a pack to the east", () => {
    const p = arrowPlacement(1200, 0, 1000, 600);
    expect(p.x).toBeCloseTo(500 + 0.42 * 1000, 9);
    expect(p.y).toBeCloseTo(300, 9);
    expect(p.angle).toBeCloseTo(0, 9);
  });

  it("north is up on the screen", () => {
    const p = arrowPlacement(0, 900, 1000, 600);
    expect(p.x).toBeCloseTo(500, 9);
    expect(p.y).toBeCloseTo(300 - 0.42 * 600, 9);
    expect(p.angle).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("the distance of the pack does not move the arrow", () => {
    const near = { ...arrowPlacement(-30, -40, 800, 800) };
    expect(near).toEqual({ ...arrowPlacement(-300, -400, 800, 800) });
    expect(arrowPlacement(-300, -400, 800, 800).x).toBeCloseTo(400 - 0.42 * 800 * 0.6, 9);
  });

  it("a zero offset does not divide by zero", () => {
    expect(arrowPlacement(0, 0, 1000, 600)).toEqual({ x: 500, y: 300, angle: 0 });
  });
});
