import { describe, expect, it } from "vitest";
import { readGameParams } from "./params";

const random = () => 777;

describe("readGameParams", () => {
  it("defaults", () => {
    expect(readGameParams("", random)).toEqual({
      seed: 777,
      speed: 1,
      debug: false,
      durationSeconds: undefined,
      renderer: "webgpu",
      fps: false,
      shadows: true,
      lang: undefined,
      hero: undefined,
      startPhase: undefined,
    });
  });

  it("clamps speed and duration", () => {
    expect(readGameParams("?speed=100&duration=1", random)).toMatchObject({ speed: 16, durationSeconds: 5 });
    expect(readGameParams("?speed=0&duration=9999", random)).toMatchObject({ speed: 1, durationSeconds: 1200 });
    expect(readGameParams("?speed=abc&duration=x", random)).toMatchObject({ speed: 1, durationSeconds: undefined });
  });

  it("duration clamps to 1200", () => {
    expect(readGameParams("?duration=1200", random).durationSeconds).toBe(1200);
    expect(readGameParams("?duration=1201", random).durationSeconds).toBe(1200);
    expect(readGameParams("?duration=1000", random).durationSeconds).toBe(1000);
  });

  it("phase needs debug", () => {
    expect(readGameParams("?phase=6", random).startPhase).toBeUndefined();
    expect(readGameParams("?phase=6&debug=0", random).startPhase).toBeUndefined();
    expect(readGameParams("?phase=6&debug=1", random).startPhase).toBe(6);
    expect(readGameParams("?debug=1&phase=1", random).startPhase).toBe(1);
    expect(readGameParams("?debug=1&phase=21", random).startPhase).toBe(21);
  });

  it("phase outside 1..21 or not a number is ignored", () => {
    for (const value of ["0", "22", "-3", "abc", "", "6.5", "1e1"]) {
      expect(readGameParams(`?debug=1&phase=${value}`, random).startPhase, value).toBeUndefined();
    }
    expect(readGameParams("?debug=1", random).startPhase).toBeUndefined();
  });

  it("uses the seed param", () => {
    expect(readGameParams("?seed=42", random).seed).toBe(42);
    expect(readGameParams("?seed=nope", random).seed).toBe(777);
  });

  it("reads the flags and the language", () => {
    expect(readGameParams("?debug=1&fps=1&renderer=webgl2&lang=cs", random)).toMatchObject({
      debug: true, fps: true, renderer: "webgl2", lang: "cs",
    });
    expect(readGameParams("?debug=true&fps=0&lang=de", random)).toMatchObject({ debug: false, fps: false, lang: undefined });
  });

  it("reads the shadows param", () => {
    expect(readGameParams("?shadows=0", random).shadows).toBe(false);
    expect(readGameParams("?shadows=1", random).shadows).toBe(true);
    expect(readGameParams("", random).shadows).toBe(true);
  });

  it("reads the hero param", () => {
    expect(readGameParams("?hero=nightglaive", random).hero).toBe("nightglaive");
    expect(readGameParams("?hero=", random).hero).toBeUndefined();
    expect(readGameParams("", random).hero).toBeUndefined();
  });
});
