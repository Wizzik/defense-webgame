import { describe, expect, it } from "vitest";
import { gameData } from "../sim/testing/game-data";
import { courseKey, emptyProgress, firstUnlocked, isUnlocked, parseProgress, type ProgressData, recordResult } from "./progress";

const W = 5;
const win = { won: true, phase: 21 };
const winAll = (p: ProgressData, difficulty: "normal" | "insane" | "hell", upTo = 5): ProgressData => {
  for (let w = 1; w <= upTo; w++) p = recordResult(p, w, difficulty, win);
  return p;
};

describe("courseKey and emptyProgress", () => {
  it("keys a world and a difficulty", () => {
    expect(courseKey(3, "insane")).toBe("3-insane");
    expect(emptyProgress()).toEqual({ version: 1, best: {} });
  });
});

describe("isUnlocked", () => {
  it("opens only world 1 on normal at first", () => {
    const p = emptyProgress();
    expect(isUnlocked(p, 1, "normal", W)).toBe(true);
    expect(isUnlocked(p, 2, "normal", W)).toBe(false);
    expect(isUnlocked(p, 1, "insane", W)).toBe(false);
    expect(isUnlocked(p, 1, "hell", W)).toBe(false);
    expect(isUnlocked(p, 0, "normal", W)).toBe(false);
    expect(isUnlocked(p, 6, "normal", W)).toBe(false);
  });

  it("a win of world N opens world N + 1 on the same difficulty; a loss does not", () => {
    let p = recordResult(emptyProgress(), 1, "normal", { won: false, phase: 20 });
    expect(isUnlocked(p, 2, "normal", W)).toBe(false);
    p = recordResult(p, 1, "normal", win);
    expect(isUnlocked(p, 2, "normal", W)).toBe(true);
    expect(isUnlocked(p, 3, "normal", W)).toBe(false);
    expect(isUnlocked(p, 2, "insane", W)).toBe(false);
  });

  it("winning world 5 on normal opens insane, not hell; world 5 on insane opens hell", () => {
    let p = winAll(emptyProgress(), "normal");
    expect(isUnlocked(p, 1, "insane", W)).toBe(true);
    expect(isUnlocked(p, 2, "insane", W)).toBe(false);
    expect(isUnlocked(p, 1, "hell", W)).toBe(false);
    p = winAll(p, "insane", 4);
    expect(isUnlocked(p, 5, "insane", W)).toBe(true);
    expect(isUnlocked(p, 1, "hell", W)).toBe(false);
    p = recordResult(p, 5, "insane", win);
    expect(isUnlocked(p, 1, "hell", W)).toBe(true);
  });

  it("is derived only from the world before: a win of 2-hell opens 3-hell and nothing else", () => {
    const p = recordResult(emptyProgress(), 2, "hell", win);
    expect(isUnlocked(p, 3, "hell", W)).toBe(true);
    expect(isUnlocked(p, 1, "hell", W)).toBe(false);
    expect(isUnlocked(p, 2, "hell", W)).toBe(false);
    expect(isUnlocked(p, 4, "hell", W)).toBe(false);
  });
});

describe("recordResult", () => {
  it("keeps the better result and returns a new object", () => {
    const start = emptyProgress();
    const p1 = recordResult(start, 1, "normal", { won: false, phase: 14 });
    expect(start.best).toEqual({});
    expect(p1.best["1-normal"]).toEqual({ won: false, phase: 14 });
    const p2 = recordResult(p1, 1, "normal", { won: false, phase: 5 });
    expect(p2.best["1-normal"]).toEqual({ won: false, phase: 14 });
    const p3 = recordResult(p2, 1, "normal", win);
    expect(p3.best["1-normal"]).toEqual(win);
    const p4 = recordResult(p3, 1, "normal", { won: false, phase: 8 });
    expect(p4.best["1-normal"]).toEqual(win);
    const p5 = recordResult(p1, 1, "normal", { won: false, phase: 18 });
    expect(p5.best["1-normal"]).toEqual({ won: false, phase: 18 });
  });
});

describe("parseProgress", () => {
  const data = gameData();

  it("reads nothing saved as empty without drops", () => {
    expect(parseProgress(null, data)).toEqual({ progress: emptyProgress(), dropped: 0 });
    expect(parseProgress(undefined, data)).toEqual({ progress: emptyProgress(), dropped: 0 });
  });

  it("drops another version or a non-object as one entry", () => {
    expect(parseProgress({ version: 2, best: { "1-normal": win } }, data)).toEqual({ progress: emptyProgress(), dropped: 1 });
    expect(parseProgress("x", data)).toEqual({ progress: emptyProgress(), dropped: 1 });
    expect(parseProgress([], data)).toEqual({ progress: emptyProgress(), dropped: 1 });
  });

  it("keeps valid entries and counts the bad ones", () => {
    const { progress, dropped } = parseProgress({
      version: 1,
      best: {
        "1-normal": win,
        "2-normal": { won: false, phase: 14 },
        "9-normal": win,
        "0-normal": win,
        "1.5-normal": win,
        "1-nightmare": win,
        "x": win,
        "3-normal": { won: false, phase: "abc" },
        "3-insane": { won: false, phase: 22 },
        "3-hell": { won: false, phase: 0 },
        "4-normal": { won: "yes", phase: 3 },
        "4-insane": { won: true, phase: 2.5 },
        "4-hell": null,
      },
    }, data);
    expect(progress.best).toEqual({ "1-normal": win, "2-normal": { won: false, phase: 14 } });
    expect(dropped).toBe(11);
    expect(isUnlocked(progress, 1, "normal", W)).toBe(true);
  });

  it("stores a key with a leading zero under its plain key", () => {
    expect(parseProgress({ version: 1, best: { "01-normal": win } }, data).progress.best).toEqual({ "1-normal": win });
  });

  it("drops a best that is not an object", () => {
    expect(parseProgress({ version: 1, best: 3 }, data)).toEqual({ progress: emptyProgress(), dropped: 1 });
  });
});

describe("firstUnlocked", () => {
  it("keeps an open course and falls back to world 1 normal for a locked one", () => {
    const p = recordResult(emptyProgress(), 1, "normal", win);
    expect(firstUnlocked(p, 2, "normal", W)).toEqual({ world: 2, difficulty: "normal" });
    expect(firstUnlocked(p, 4, "hell", W)).toEqual({ world: 1, difficulty: "normal" });
    expect(firstUnlocked(p, 9, "normal", W)).toEqual({ world: 1, difficulty: "normal" });
  });
});
