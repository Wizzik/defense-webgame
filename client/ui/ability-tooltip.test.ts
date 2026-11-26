import { describe, expect, it } from "vitest";
import { createRun } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { abilityTooltip } from "./ability-tooltip";

describe("abilityTooltip", () => {
  it("names the level and compares it with the next one", () => {
    const run = createRun(gameData(), { seed: 1 });
    const info = abilityTooltip(run, 0, "en")!;
    const def = run.abilities[0]!.def;
    expect(info.name).toBe(def.name.en);
    expect(info.sub).toBe(`Level 1 / ${def.levels}`);
    expect(info.nextHeading).toBe("Now → next level");
    expect(info.lines.some((line) => line.startsWith("Damage") && line.includes("→"))).toBe(true);
  });

  it("shows only the values at the top level, in Czech too", () => {
    const run = createRun(gameData(), { seed: 1 });
    const slot = run.abilities[0]!;
    slot.level = slot.def.levels;
    const info = abilityTooltip(run, 0, "cs")!;
    expect(info.sub).toContain("nejvyšší");
    expect(info.nextHeading).toBe("");
    expect(info.lines.every((line) => !line.includes("→"))).toBe(true);
  });

  it("is null for an empty slot", () => {
    const run = createRun(gameData(), { seed: 1 });
    expect(abilityTooltip(run, 4, "en")).toBeNull();
  });
});
