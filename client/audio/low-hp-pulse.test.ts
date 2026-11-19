import { describe, expect, it } from "vitest";
import { LowHpPulse } from "./low-hp-pulse";

describe("LowHpPulse", () => {
  it("starts under 25 % and stops over 30 %", () => {
    const p = new LowHpPulse();
    expect(p.update(26, 100, true, 0)).toBe(false);
    expect(p.update(24, 100, true, 1)).toBe(true);
    expect(p.update(28, 100, true, 2)).toBe(true); // still on between 25 and 30 %
    expect(p.update(31, 100, true, 3)).toBe(false);
    expect(p.update(28, 100, true, 4)).toBe(false); // off again until under 25 %
  });

  it("beats every 0.9 s", () => {
    const p = new LowHpPulse();
    expect(p.update(10, 100, true, 0)).toBe(true);
    expect(p.update(10, 100, true, 0.5)).toBe(false);
    expect(p.update(10, 100, true, 0.89)).toBe(false);
    expect(p.update(10, 100, true, 0.9)).toBe(true);
  });

  it("stops the pulse when the run is not playing", () => {
    const p = new LowHpPulse();
    expect(p.update(10, 100, true, 0)).toBe(true);
    expect(p.update(10, 100, false, 1)).toBe(false);
    expect(p.update(10, 100, false, 2)).toBe(false);
  });
});
