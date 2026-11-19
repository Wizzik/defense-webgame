import { describe, expect, it } from "vitest";
import { GAME_SOUNDS } from "../../data/schema/audio";
import { validateAudio } from "./validate";

const game = {
  abilities: [
    { id: "rock-rupture", kind: "line" },
    { id: "might", kind: "passive" },
  ],
  heroes: [{ id: "stonehorn" }],
  enemies: [{ id: "scout" }],
};

function raw(): Record<string, unknown> {
  return {
    cues: [
      { id: "a", files: ["audio/sfx/a.ogg"] },
      { id: "b", files: [], synth: "cast" },
    ],
    tracks: [],
    abilities: { "rock-rupture": { cast: "a", hit: "b" }, might: { cast: "none" } },
    heroes: { stonehorn: { attack: "a" } },
    enemies: { scout: { death: "b" } },
    sounds: Object.fromEntries(GAME_SOUNDS.map((s) => [s, "b"])),
  };
}

const exists = () => true;

describe("validateAudio", () => {
  it("accepts complete data", () => {
    expect(validateAudio(raw(), game, exists).cues).toHaveLength(2);
  });

  it("requires a cue for every ability, passives as none", () => {
    const r = raw();
    r.abilities = { might: { cast: "none" } };
    expect(() => validateAudio(r, game, exists)).toThrow(/ability rock-rupture/);
  });

  it("rejects a passive with a sound", () => {
    const r = raw();
    (r.abilities as Record<string, unknown>).might = { cast: "a" };
    expect(() => validateAudio(r, game, exists)).toThrow(/passive might/);
  });

  it("requires every hero and enemy", () => {
    const r = raw();
    r.heroes = {};
    r.enemies = {};
    expect(() => validateAudio(r, game, exists)).toThrow(/hero stonehorn[\s\S]*enemy scout|enemy scout[\s\S]*hero stonehorn/);
  });

  it("rejects an unknown cue reference", () => {
    const r = raw();
    (r.abilities as Record<string, unknown>)["rock-rupture"] = { cast: "nope" };
    expect(() => validateAudio(r, game, exists)).toThrow(/unknown cue nope/);
  });

  it("rejects a missing file", () => {
    expect(() => validateAudio(raw(), game, () => false)).toThrow(/missing file audio\/sfx\/a.ogg/);
  });

  it("accepts a cue with only synth", () => {
    const r = raw();
    r.cues = [{ id: "a", files: [], synth: "hit" }, { id: "b", files: [], synth: "cast" }];
    expect(() => validateAudio(r, game, () => false)).not.toThrow();
  });

  it("lists all problems at once", () => {
    const r = raw();
    r.heroes = {};
    r.enemies = {};
    try {
      validateAudio(r, game, exists);
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message.split("\n")).toHaveLength(2);
    }
  });
});
