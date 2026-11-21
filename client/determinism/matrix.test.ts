import { describe, expect, it } from "vitest";
import { gameData } from "../../sim/testing/game-data";
import { firstDifference, matrixCases, matrixDigest, runCase, type CaseResult, type MatrixCase } from "./matrix";

describe("matrixCases", () => {
  it("lists the eight heroes, four start phases, two harder courses and the storm with unique ids", () => {
    const data = gameData();
    const cases = matrixCases(data);
    expect(cases).toHaveLength(15);
    expect(cases.find((c) => c.id === "w1-storm")).toMatchObject({ hero: "sparkshot", seed: 9, startPhase: 3, maxTicks: 4500 });
    expect(cases.slice(0, 8).map((c) => c.id)).toEqual(data.heroes.map((h) => `h-${h.id}`));
    expect(cases.slice(8).map((c) => c.id)).toEqual(["p6", "p11", "p16", "p21", "w3-insane", "w5-hell", "w1-storm"]);
    expect(cases.find((c) => c.id === "w3-insane")).toMatchObject({ hero: "stonehorn", seed: 6, world: 3, difficulty: "insane" });
    expect(cases.find((c) => c.id === "w5-hell")).toMatchObject({ hero: "redcleaver", seed: 7, world: 5, difficulty: "hell", startPhase: 6 });
    expect(new Set(cases.map((c) => c.id)).size).toBe(15);
  });

  it("the harder courses repeat their checkpoints and differ from world 1 normal", () => {
    const data = gameData();
    for (const id of ["w3-insane", "w5-hell"]) {
      const c = { ...matrixCases(data).find((m) => m.id === id)!, maxTicks: 900 };
      const first = runCase(data, c);
      expect(runCase(data, c).checkpoints, id).toEqual(first.checkpoints);
      expect(runCase(data, { ...c, world: 1, difficulty: "normal" }).checkpoints, id).not.toEqual(first.checkpoints);
    }
  });
});

describe("runCase", () => {
  const short: MatrixCase = { id: "t", hero: "stonehorn", seed: 1, gear: "none", maxTicks: 650 };

  it("checkpoints every 300 steps and after the last step", () => {
    const result = runCase(gameData(), short);
    expect(result.ticks).toBe(650);
    expect(result.checkpoints).toHaveLength(3);
    expect(result.state).toBe("playing");
  });

  it("does not repeat a checkpoint when the last step falls on the period", () => {
    const result = runCase(gameData(), { ...short, maxTicks: 600 });
    expect(result.checkpoints).toHaveLength(2);
  });

  it("ends early with a checkpoint after the last step", () => {
    const ending: MatrixCase = {
      id: "end", hero: "stonehorn", seed: 1, gear: "none", maxTicks: 30_000, idle: true,
    };
    const result = runCase(gameData(), ending);
    expect(result.ticks).toBeLessThan(30_000);
    expect(["won", "lost"]).toContain(result.state);
    expect(result.checkpoints).toHaveLength(Math.ceil(result.ticks / 300));
  });

  it("repeats the same checkpoints", () => {
    expect(runCase(gameData(), short).checkpoints).toEqual(runCase(gameData(), short).checkpoints);
  });
});

describe("matrixDigest and firstDifference", () => {
  const a: CaseResult[] = [
    { id: "x", ticks: 600, state: "playing", checkpoints: [1, 2] },
    { id: "y", ticks: 300, state: "lost", checkpoints: [3] },
  ];
  const b: CaseResult[] = [a[0]!, { ...a[1]!, checkpoints: [4] }];

  it("gives eight hex digits that change with one checkpoint", () => {
    expect(matrixDigest(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(matrixDigest(b)).not.toBe(matrixDigest(a));
  });

  it("finds the first different checkpoint", () => {
    expect(firstDifference(a, a)).toBeNull();
    expect(firstDifference(a, b)).toEqual({ id: "y", index: 0 });
    expect(firstDifference(a, [a[0]!])).toEqual({ id: "y", index: 0 });
  });
});
