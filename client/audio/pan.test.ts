import { describe, expect, it } from "vitest";
import { panFromNdc } from "./pan";

describe("panFromNdc", () => {
  it("pans by screen x and quiets off-screen", () => {
    expect(panFromNdc(0.5, 0)).toEqual({ pan: 0.35, gain: 1 });
    const off = panFromNdc(1.4, 0);
    expect(off.pan).toBe(0.7);
    expect(off.gain).toBe(0.6);
    expect(panFromNdc(0, -1.2).gain).toBe(0.6);
    expect(panFromNdc(-3, 0).pan).toBe(-0.7);
  });
});
