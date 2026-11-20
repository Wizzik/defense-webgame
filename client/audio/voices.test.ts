import { describe, expect, it } from "vitest";
import { VoiceLimiter } from "./voices";

describe("VoiceLimiter", () => {
  it("caps a burst of 200 starts", () => {
    const v = new VoiceLimiter();
    let ok = 0;
    for (let i = 0; i < 200; i++) if (v.start("enemy-death", 6, 0, 1, 0.5).ok) ok++;
    expect(ok).toBe(6);
  });

  it("caps the total at 32", () => {
    const v = new VoiceLimiter();
    let ok = 0;
    for (let i = 0; i < 50; i++) if (v.start(`cue-${i}`, 4, 1, 1, 1).ok) ok++;
    expect(ok).toBe(32);
  });

  it("lets a higher priority steal the oldest lower one", () => {
    const v = new VoiceLimiter();
    const first = v.start("c0", 4, 0, 1, 5);
    for (let i = 1; i < 32; i++) v.start(`c${i}`, 4, 0, 1 + i * 0.01, 5);
    const r = v.start("warn", 1, 3, 2, 1);
    expect(r.ok).toBe(true);
    expect(r.steal).toBe(first.id);
    expect(v.start("same", 1, 0, 2, 1).ok).toBe(false);
  });

  it("frees voices after they end", () => {
    const v = new VoiceLimiter();
    for (let i = 0; i < 6; i++) v.start("d", 6, 0, 1, 0.5);
    expect(v.start("d", 6, 0, 1.2, 0.5).ok).toBe(false);
    expect(v.start("d", 6, 0, 1.5, 0.5).ok).toBe(true);
  });

  it("frees a voice on end", () => {
    const v = new VoiceLimiter();
    const a = v.start("x", 1, 0, 1, 9);
    expect(v.start("x", 1, 0, 1, 9).ok).toBe(false);
    v.end(a.id);
    expect(v.start("x", 1, 0, 1, 9).ok).toBe(true);
  });
});
