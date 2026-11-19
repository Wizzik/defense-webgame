import { describe, expect, it } from "vitest";
import { CueSchema } from "../../data/schema/audio";
import { vary } from "./variation";

const cue = CueSchema.parse({ id: "c", files: ["a.ogg", "b.ogg", "c.ogg"] });

describe("vary", () => {
  it("keeps rate within the pitch spread", () => {
    expect(vary(cue, () => 0).rate).toBeCloseTo(0.94);
    expect(vary(cue, () => 0.999999).rate).toBeCloseTo(1.06, 4);
  });

  it("keeps gain within the gain spread", () => {
    expect(vary(cue, () => 0).gain).toBeCloseTo(10 ** (-2 / 20));
    expect(vary(cue, () => 0.5).gain).toBeCloseTo(1);
  });

  it("picks every variant over many draws", () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const seen = new Set<string | null>();
    for (let i = 0; i < 200; i++) seen.add(vary(cue, rand).file);
    expect([...seen].sort()).toEqual(["a.ogg", "b.ogg", "c.ogg"]);
  });

  it("returns null file for a synth-only cue", () => {
    expect(vary(CueSchema.parse({ id: "s", files: [], synth: "hit" }), () => 0.3).file).toBeNull();
  });
});
