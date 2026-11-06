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
      lang: undefined,
    });
  });

  it("clamps speed and duration", () => {
    expect(readGameParams("?speed=100&duration=1", random)).toMatchObject({ speed: 16, durationSeconds: 5 });
    expect(readGameParams("?speed=0&duration=9999", random)).toMatchObject({ speed: 1, durationSeconds: 600 });
    expect(readGameParams("?speed=abc&duration=x", random)).toMatchObject({ speed: 1, durationSeconds: undefined });
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
});
