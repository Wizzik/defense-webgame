import { describe, expect, it } from "vitest";
import { frameStats } from "./frame-stats";

function expectNear(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("frameStats", () => {
  it("frameStats of constant 16.667 ms is 60/60", () => {
    const durations = new Float32Array(120).fill(16.667);
    const stats = frameStats(durations, 120, new Float32Array(120));
    expectNear(stats.avgFps, 60, 0.1);
    expectNear(stats.low1Fps, 60, 0.1);
  });

  it("frameStats low1 reflects spikes", () => {
    // 100 valid frames in a 120-slot buffer; the unused tail must be ignored
    const durations = new Float32Array(120).fill(500);
    durations.fill(10, 0, 100);
    durations[37] = 100;
    const stats = frameStats(durations, 100, new Float32Array(120));
    expectNear(stats.low1Fps, 10, 0.1);
    expectNear(stats.avgFps, 1000 / 10.9, 0.1);
  });
});
