import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings } from "./store";

function memory(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(SETTINGS_KEY, initial);
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe("settings store", () => {
  it("falls back to defaults", () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings({ getItem: () => { throw new Error("denied"); } })).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memory("{not json"))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memory("null"))).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps bad values", () => {
    const s = loadSettings(memory(JSON.stringify({ master: 7, music: -1, sfx: "x", shake: "no", numbers: false })));
    expect(s).toEqual({ master: 1, music: 0, sfx: 0.8, shake: true, numbers: false });
  });

  it("round-trips", () => {
    const store = memory();
    const s = { master: 0.3, music: 0.2, sfx: 0.9, shake: false, numbers: false };
    saveSettings(store, s);
    expect(loadSettings(store)).toEqual(s);
  });

  it("swallows storage errors on save", () => {
    expect(() => saveSettings({ setItem: () => { throw new Error("full"); } }, DEFAULT_SETTINGS)).not.toThrow();
    expect(() => saveSettings(null, DEFAULT_SETTINGS)).not.toThrow();
  });
});
