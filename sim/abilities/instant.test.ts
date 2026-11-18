import { describe, expect, it } from "vitest";
import { Role } from "../enemies";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, addEnemy, eventsOf } from "../testing/ability-run";
import { learnAbility } from "./slots";
import { strongestEnemy } from "./targeting";

const SLOT = 4;

function smiteRun() {
  const run = abilityRun("stonehorn", {});
  learnAbility(run, SLOT, run.data.abilities.findIndex((a) => a.id === "smite"));
  const def = run.abilities[SLOT].def;
  if (def.kind !== "instant") throw new Error("test setup");
  return { run, p: def.params };
}

function addOfType(run: ReturnType<typeof abilityRun>, typeIndex: number, dx: number, dy: number, hp: number): number {
  const i = run.enemies.spawn(typeIndex, Role.Hunter, run.hero.x + dx, run.hero.y + dy, hp, 1, 0);
  run.enemies.stunTicks[i] = 1e6;
  return i;
}

describe("instant", () => {
  it("prefers an elite in range to a common enemy with more hp, and takes the most hp otherwise", () => {
    const { run, p } = smiteRun();
    const elite = run.data.enemies.findIndex((e) => e.hunter === true && !e.boss);
    expect(elite).toBeGreaterThanOrEqual(0);
    addEnemy(run, 100, 0, 5e5);
    const big = addEnemy(run, -100, 0, 9e5);
    expect(strongestEnemy(run, run.hero.x, run.hero.y, p.range[0])).toBe(big);
    const e = addOfType(run, elite, 0, 200, 1e5);
    addOfType(run, elite, 0, p.range[0] + 300, 1e6); // out of range
    expect(strongestEnemy(run, run.hero.x, run.hero.y, p.range[0])).toBe(e);
    run.step(NO_INPUT);
    const hits = eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 1);
    expect(hits.map((k) => run.events.a[k])).toEqual([e]);
    expect(run.events.value[hits[0]]).toBeCloseTo(p.damage[0] * run.hero.stats.spellPower, 9);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts.map((k) => run.events.a[k])).toEqual([SLOT]);
    expect([run.events.x[casts[0]], run.events.y[casts[0]]]).toEqual([run.enemies.x[e], run.enemies.y[e]]);
    expect(run.abilities[SLOT].cooldown).toBeGreaterThan(0);
  });

  it("a boss beats an elite; ties go to the lower slot", () => {
    const { run, p } = smiteRun();
    const boss = run.data.enemies.findIndex((e) => e.boss === true);
    const a = addEnemy(run, 100, 0, 1000);
    addEnemy(run, -100, 0, 1000);
    expect(strongestEnemy(run, run.hero.x, run.hero.y, p.range[0])).toBe(a);
    const b = addOfType(run, boss, 0, 300, 10);
    expect(strongestEnemy(run, run.hero.x, run.hero.y, p.range[0])).toBe(b);
  });

  it("does nothing without an enemy in range", () => {
    const { run, p } = smiteRun();
    addEnemy(run, 0, p.range[0] + 200);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast)).toHaveLength(0);
    expect(run.abilities[SLOT].cooldown).toBe(0);
  });
});
