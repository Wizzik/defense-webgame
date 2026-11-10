import { describe, expect, it } from "vitest";
import { createRun } from "../../sim";
import { gameData } from "../../sim/testing/game-data";
import { cardLines } from "./card-lines";

function stonehornRun() {
  return createRun(gameData(), { seed: 1 });
}

describe("cardLines", () => {
  it("ability card lists changed params with spell power", () => {
    const run = stonehornRun();
    const lines = cardLines(run, { kind: "ability", slot: 0, fromLevel: 1, toLevel: 2 });
    const params = run.data.abilities.find((a) => a.id === run.data.heroes[run.heroIndex].signatureAbilities[0])!.params as Record<string, number[]>;
    const { spellPower } = run.hero.stats;
    expect(lines).toEqual([
      { label: "stat.damage", from: String(Math.round(params.damage[0] * spellPower)), to: String(Math.round(params.damage[1] * spellPower)) },
      { label: "stat.width", from: "350", to: "400" },
    ]);
  });

  it("strength card shows max hp and regen", () => {
    const run = stonehornRun();
    const lines = cardLines(run, { kind: "attribute", attribute: "str", amount: 10 });
    expect(lines).toEqual([
      { label: "stat.maxHp", from: "1325", to: "1475" },
      { label: "stat.regen", from: "2", to: "2.5" },
    ]);
  });

  it("intelligence card shows spell power and cooldowns", () => {
    const run = stonehornRun();
    const lines = cardLines(run, { kind: "attribute", attribute: "int", amount: 10 });
    expect(lines).toEqual([
      { label: "stat.spellPower", from: "+24 %", to: "+34 %" },
      { label: "stat.cooldownScale", from: "−19 %", to: "−25 %" },
    ]);
  });

  function paramsOf(run: ReturnType<typeof stonehornRun>, slot: number) {
    return run.abilities[slot].def.params as Record<string, number[]>;
  }

  it("learn card lists level 1 values", () => {
    const run = createRun(gameData(), { seed: 1, hero: "nightglaive" });
    expect(run.abilities[0].def.id).toBe("falling-stars");
    const params = paramsOf(run, 0);
    const { spellPower } = run.hero.stats;
    const lines = cardLines(run, { kind: "ability", slot: 0, fromLevel: 0, toLevel: 1 });
    expect(lines).toContainEqual({ label: "stat.damage", from: "", to: String(Math.round(params.damage[0] * spellPower)) });
    expect(lines).toContainEqual({ label: "stat.radius", from: "", to: String(params.radius[0]) });
    expect(lines).toContainEqual({ label: "stat.slow", from: "", to: `+${Math.round(params.slow[0] * 100)} %` });
    expect(lines.every((l) => l.from === "")).toBe(true);
  });

  it("percent params read as percent", () => {
    const run = createRun(gameData(), { seed: 1, hero: "nightglaive" });
    expect(run.abilities[2].def.id).toBe("swift-pace");
    const params = paramsOf(run, 2);
    const lines = cardLines(run, { kind: "ability", slot: 2, fromLevel: 1, toLevel: 2 });
    expect(lines).toContainEqual({
      label: "stat.moveSpeedBonus",
      from: `+${Math.round(params.moveSpeedBonus[0] * 100)} %`,
      to: `+${Math.round(params.moveSpeedBonus[1] * 100)} %`,
    });
  });

  it("empower reads as a percent", () => {
    const run = stonehornRun();
    expect(run.abilities[1].def.id).toBe("enhanced-totem");
    const params = paramsOf(run, 1);
    const lines = cardLines(run, { kind: "ability", slot: 1, fromLevel: 0, toLevel: 1 });
    expect(lines).toContainEqual({ label: "stat.empower", from: "", to: `+${Math.round(params.empower[0] * 100)} %` });
  });

  it("every ability kind with a learn card has at least one line", () => {
    const data = gameData();
    for (const hero of data.heroes) {
      const run = createRun(data, { seed: 1, hero: hero.id });
      run.abilities.forEach((slot, i) => {
        const lines = cardLines(run, { kind: "ability", slot: i, fromLevel: 0, toLevel: 1 });
        expect(lines.length, slot.def.id).toBeGreaterThan(0);
      });
    }
  });
});
