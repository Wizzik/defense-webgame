import { describe, expect, it } from "vitest";
import { weatherFog } from "./weather-fx";
import { lookOf } from "./world-look";

const red = lookOf("red-waste");
const FADE = 45;
const DURATION = 15 * 30;

describe("weatherFog", () => {
  it("fog of the world outside the weather", () => {
    expect(weatherFog(red, 0, FADE, DURATION)).toEqual({ color: red.sky, near: red.fog.near, far: red.fog.far });
    const wood = lookOf("shadewood");
    expect(weatherFog(wood, 100, FADE, DURATION)).toEqual({ color: wood.sky, near: wood.fog.near, far: wood.fog.far });
  });

  it("fog reaches the weather fog after fadeTicks and returns before the end", () => {
    const w = red.weather!;
    // weatherTicks counts down from DURATION: FADE steps after the start it is the weather fog
    expect(weatherFog(red, DURATION - FADE, FADE, DURATION)).toEqual({ color: w.color, near: w.fogNear, far: w.fogFar });
    expect(weatherFog(red, FADE, FADE, DURATION)).toEqual({ color: w.color, near: w.fogNear, far: w.fogFar });
    const early = weatherFog(red, DURATION - 10, FADE, DURATION);
    expect(early.near).toBeLessThan(red.fog.near);
    expect(early.near).toBeGreaterThan(w.fogNear);
    const late = weatherFog(red, 10, FADE, DURATION);
    expect(late.far).toBeLessThan(red.fog.far);
    expect(late.far).toBeGreaterThan(w.fogFar);
  });
});
