import { describe, expect, it } from "vitest";
import { SYNTH_NAMES } from "../../data/schema/audio";
import { FakeContext } from "./fake-context";
import { Sfx } from "./sfx";

describe("Sfx", () => {
  it("plays every synth name into the given node", () => {
    const ctx = new FakeContext();
    const sfx = new Sfx(ctx as unknown as AudioContext);
    const out = ctx.createGain();
    for (const name of SYNTH_NAMES) sfx.synth(name, 1, out as unknown as AudioNode);
    expect(ctx.oscillators).toBeGreaterThanOrEqual(SYNTH_NAMES.length);
  });
});
