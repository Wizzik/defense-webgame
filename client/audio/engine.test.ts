import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioDataSchema, GAME_SOUNDS } from "../../data/schema/audio";
import { AudioEngine } from "./engine";
import { FakeContext } from "./fake-context";
import { vary } from "./variation";

function data(files: string[] = ["audio/sfx/d.ogg"]) {
  return AudioDataSchema.parse({
    cues: [
      { id: "enemy-death", files, synth: "death", maxVoices: 6, priority: 0 },
      { id: "click", files: [], synth: "pickup", category: "ui" },
    ],
    tracks: [],
    abilities: {},
    heroes: {},
    enemies: {},
    sounds: Object.fromEntries(GAME_SOUNDS.map((s) => [s, "click"])),
  });
}

const okFetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as unknown as Response);
const badFetch = vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response);

function engine(d = data(), fetchFn = okFetch) {
  const ctx = new FakeContext();
  const e = new AudioEngine(d, "/base/", () => ctx as unknown as AudioContext, { fetch: fetchFn, rand: () => 0.25 });
  return { e, ctx };
}

afterEach(() => vi.restoreAllMocks());

describe("AudioEngine", () => {
  it("plays nothing before enable", () => {
    const { e, ctx } = engine();
    expect(() => e.play("enemy-death")).not.toThrow();
    expect(ctx.sources).toHaveLength(0);
    expect(ctx.oscillators).toBe(0);
    expect(e.context).toBeNull();
  });

  it("plays a decoded variant with rate and pan", async () => {
    const d = data();
    const { e, ctx } = engine(d);
    e.enable();
    await e.preload();
    expect(okFetch).toHaveBeenCalledWith("/base/audio/sfx/d.ogg");
    e.play("enemy-death", { pan: 0.35 });
    const source = ctx.sources.at(-1)!;
    expect(source.started).toBe(true);
    expect(source.playbackRate.value).toBeCloseTo(vary(d.cues[0]!, () => 0.25).rate);
    expect(ctx.panners.at(-1)!.pan.value).toBe(0.35);
  });

  it("falls back to synth once per cue", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { e, ctx } = engine(data(), badFetch);
    e.enable();
    await e.preload();
    for (let i = 0; i < 3; i++) {
      ctx.currentTime += 1;
      e.play("enemy-death");
    }
    expect(ctx.sources.filter((s) => s.buffer && s.buffer.duration === 0.4)).toHaveLength(0);
    expect(ctx.oscillators).toBeGreaterThanOrEqual(3);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("respects the voice limit", async () => {
    const { e, ctx } = engine();
    e.enable();
    await e.preload();
    const before = ctx.sources.length;
    for (let i = 0; i < 10; i++) e.play("enemy-death");
    expect(ctx.sources.length - before).toBe(6);
  });

  it("applies volumes and mute", () => {
    const { e } = engine();
    e.enable();
    e.setVolumes({ master: 0.5, music: 0.2, sfx: 1 });
    expect(e.levels()).toEqual({ master: 0.5, music: 0.2, sfx: 1, ui: 1 });
    e.setMuted(true);
    expect(e.levels().master).toBe(0);
    e.setMuted(false);
    expect(e.levels().master).toBe(0.5);
  });

  it("plays a synth-only ui cue", () => {
    const { e, ctx } = engine();
    e.enable();
    e.play("click");
    expect(ctx.oscillators).toBeGreaterThan(0);
  });
});
