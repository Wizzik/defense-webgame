import { describe, expect, it } from "vitest";
import { CueSchema } from "./audio";

describe("CueSchema", () => {
  it("fills the defaults", () => {
    const cue = CueSchema.parse({ id: "stone-impact", files: ["audio/sfx/a.ogg"] });
    expect(cue.pitchSpread).toBe(0.06);
    expect(cue.gainSpreadDb).toBe(2);
    expect(cue.maxVoices).toBe(1);
    expect(cue.priority).toBe(1);
    expect(cue.gainDb).toBe(0);
    expect(cue.category).toBe("sfx");
  });

  it("rejects a cue with neither files nor synth", () => {
    expect(CueSchema.safeParse({ id: "silent", files: [] }).success).toBe(false);
  });

  it("accepts a cue with only synth", () => {
    expect(CueSchema.safeParse({ id: "beep", files: [], synth: "hit" }).success).toBe(true);
  });
});
