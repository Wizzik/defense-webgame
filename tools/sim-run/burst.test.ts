import { describe, expect, it } from "vitest";
import { TICKS_PER_SECOND } from "../../sim/constants";
import { timeScale } from "../../sim/spawner";
import { abilityRun } from "../../sim/testing/ability-run";
import { gameData } from "../../sim/testing/game-data";
import { attackHit, BURST_PHASES, burstLine, spellBurst } from "./burst";
import type { RunSummary } from "./run";

describe("spell burst", () => {
  it("one cast of the strongest learned signature spell times spell power", () => {
    const run = abilityRun("stonehorn", { 0: 3 });
    const damage = (run.abilities[0]!.def.params as Record<string, number[]>).damage!;
    expect(spellBurst(run)).toBeCloseTo(damage[2]! * run.hero.stats.spellPower, 9);
  });

  it("no learned signature spell gives 0; a heal-only spell is not counted", () => {
    expect(spellBurst(abilityRun("stonehorn", {}))).toBe(0);
    const shaman = abilityRun("serpent-shaman", { 2: 3 });
    expect(shaman.abilities[2]!.def.id).toBe("mending-tide");
    expect(spellBurst(shaman)).toBe(0);
  });

  it("the attack hit is the middle of the damage range", () => {
    const run = abilityRun("stonehorn", {});
    expect(attackHit(run)).toBe((run.hero.stats.damageMin + run.hero.stats.damageMax) / 2);
  });

  it("burstLine prints the median and the ratios to shieldbearer and lancer hp at the phase start", () => {
    const data = gameData();
    expect(BURST_PHASES).toEqual([5, 10, 15, 20]);
    const hp = (id: string) => data.enemies.find((e) => e.id === id)!.hp;
    const at = (phase: number) => timeScale(data.rules, (phase - 1) * data.rules.run.phaseSeconds * TICKS_PER_SECOND);
    const sb5 = hp("shieldbearer") * at(5);
    const ln5 = hp("lancer") * at(5);
    const sb10 = hp("shieldbearer") * at(10);
    const ln10 = hp("lancer") * at(10);
    const r = (x: number) => x.toFixed(2);
    const summaries = [
      { burst: [100, 200, null, null], attack: [10, 20, null, null] },
      { burst: [300, 400, null, null], attack: [30, 40, null, null] },
    ] as unknown as RunSummary[];
    expect(burstLine(summaries, data)).toBe(
      `  burst p5 spell 200 (sb ${r(200 / sb5)} ln ${r(200 / ln5)}) attack 20 (ln ${r(20 / ln5)}) | ` +
        `p10 spell 300 (sb ${r(300 / sb10)} ln ${r(300 / ln10)}) attack 30 (ln ${r(30 / ln10)}) | p15 - | p20 -`,
    );
  });
});
