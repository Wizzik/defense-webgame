import { describe, expect, it } from "vitest";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, addEnemy, eventsOf } from "../testing/ability-run";
import { learnAbility } from "./slots";

const SLOT = 4;

function chainRun(level: number) {
  const run = abilityRun("stonehorn", {});
  learnAbility(run, SLOT, run.data.abilities.findIndex((a) => a.id === "arc-lightning"));
  run.abilities[SLOT].level = level;
  const def = run.abilities[SLOT].def;
  if (def.kind !== "chain") throw new Error("test setup");
  return { run, p: def.params, L: level - 1 };
}

function spellHits(run: ReturnType<typeof abilityRun>): number[] {
  return eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 1).map((k) => run.events.a[k]);
}

describe("chain", () => {
  it("strikes the nearest enemy and leaps bounces times, nobody twice", () => {
    const { run, p, L } = chainRun(3);
    const step = p.bounceRange[L] * 0.8;
    const enemies: number[] = [];
    for (let k = 0; k < 10; k++) enemies.push(addEnemy(run, 0, 300 + k * step));
    run.step(NO_INPUT);
    const hits = spellHits(run);
    expect(hits).toHaveLength(1 + p.bounces[L]);
    expect(new Set(hits).size).toBe(hits.length);
    expect(hits).toEqual(enemies.slice(0, 1 + p.bounces[L]));
    const blasts = eventsOf(run, EventKind.Blast).filter((k) => run.events.a[k] === SLOT);
    expect(blasts).toHaveLength(hits.length);
    for (const k of eventsOf(run, EventKind.Hit)) {
      expect(run.events.value[k]).toBeCloseTo(p.damage[L] * run.hero.stats.spellPower, 9);
    }
  });

  it("does not leap farther than bounceRange", () => {
    const { run, p, L } = chainRun(5);
    const first = addEnemy(run, 0, 300);
    addEnemy(run, 0, 300 + p.bounceRange[L] + 50);
    run.step(NO_INPUT);
    expect(spellHits(run)).toEqual([first]);
  });

  it("casts only with an enemy in range, then cools down", () => {
    const { run, p, L } = chainRun(1);
    addEnemy(run, 0, p.range[L] + 100);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast)).toHaveLength(0);
    addEnemy(run, 0, 200);
    run.step(NO_INPUT);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts).toHaveLength(1);
    expect(run.events.a[casts[0]]).toBe(SLOT);
    expect(run.events.u[casts[0]]).toBeCloseTo(0, 9);
    expect(run.events.v[casts[0]]).toBeCloseTo(1, 9);
    expect(run.abilities[SLOT].cooldown).toBeGreaterThan(0);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast)).toHaveLength(0);
  });
});
