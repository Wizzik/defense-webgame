import { describe, expect, it } from "vitest";
import { shadowsEnabled, snapToTexel } from "./shadows";

describe("shadowsEnabled", () => {
  it("is on only when asked for and not on a software GPU", () => {
    expect(shadowsEnabled(true, false)).toBe(true);
    expect(shadowsEnabled(true, true)).toBe(false);
    expect(shadowsEnabled(false, false)).toBe(false);
    expect(shadowsEnabled(false, true)).toBe(false);
  });
});

describe("snapToTexel", () => {
  const texel = 68 / 2048;

  it("lands on the texel grid, on the nearest texel", () => {
    const snapped = snapToTexel(10.013, 68, 2048);
    const n = snapped / texel;
    expect(Math.abs(n - Math.round(n))).toBeLessThan(1e-9);
    expect(Math.abs(snapped - 10.013)).toBeLessThanOrEqual(texel / 2 + 1e-12);
  });

  it("gives one result for values less than half a texel apart", () => {
    const base = 5 * texel;
    expect(snapToTexel(base + 0.2 * texel, 68, 2048)).toBe(snapToTexel(base - 0.2 * texel, 68, 2048));
    expect(snapToTexel(base + 0.6 * texel, 68, 2048)).not.toBe(snapToTexel(base, 68, 2048));
  });
});
