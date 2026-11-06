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
    expect(lines).toEqual([
      { label: "stat.damage", from: "620", to: "1240" },
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
});
