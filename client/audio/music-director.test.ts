import { describe, expect, it } from "vitest";
import { type MusicInput, MusicDirector, musicSlot } from "./music-director";

const base: MusicInput = { menuOpen: false, state: "playing", bossAlive: false, finale: false, panelOpen: false };

describe("musicSlot", () => {
  it("menu wins over everything", () => {
    expect(musicSlot({ ...base, menuOpen: true, bossAlive: true, finale: true, state: "won" })).toBe("menu");
  });

  it("picks final, miniboss and run", () => {
    expect(musicSlot({ ...base, bossAlive: true, finale: true })).toBe("final");
    expect(musicSlot({ ...base, bossAlive: true })).toBe("miniboss");
    expect(musicSlot({ ...base, finale: true })).toBe("run");
    expect(musicSlot(base)).toBe("run");
  });

  it("plays victory and defeat after the run ends", () => {
    expect(musicSlot({ ...base, state: "won", bossAlive: true })).toBe("victory");
    expect(musicSlot({ ...base, state: "lost" })).toBe("defeat");
  });
});

describe("MusicDirector", () => {
  it("ducks with lowpass while the game stands", () => {
    const d = new MusicDirector();
    expect(d.duck({ ...base, state: "levelUp" }, 0)).toEqual({ gain: 0.35, lowpass: true });
    expect(d.duck({ ...base, state: "chest" }, 0)).toEqual({ gain: 0.35, lowpass: true });
    expect(d.duck({ ...base, panelOpen: true }, 0)).toEqual({ gain: 0.35, lowpass: true });
    expect(d.duck(base, 0)).toEqual({ gain: 1, lowpass: false });
  });

  it("ducks for 2.5 s after an alert", () => {
    const d = new MusicDirector();
    d.onAlert(10);
    expect(d.duck(base, 11)).toEqual({ gain: 0.5, lowpass: false });
    expect(d.duck(base, 12.6)).toEqual({ gain: 1, lowpass: false });
  });

  it("does not duck in the menu", () => {
    const d = new MusicDirector();
    d.onAlert(10);
    expect(d.duck({ ...base, menuOpen: true, state: "levelUp" }, 11)).toEqual({ gain: 1, lowpass: false });
  });
});
