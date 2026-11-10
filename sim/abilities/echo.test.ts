import { describe, expect, it } from "vitest";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, addEnemy, eventsOf, quietData } from "../testing/ability-run";

function params(data: ReturnType<typeof quietData>) {
  const rupture = data.abilities.find((a) => a.id === "rock-rupture");
  const echo = data.abilities.find((a) => a.id === "seismic-echo");
  if (rupture?.kind !== "line" || echo?.kind !== "on_cast") throw new Error("test setup");
  return { rupture: rupture.params, echo: echo.params };
}

function castSlots(run: ReturnType<typeof abilityRun>): number[] {
  return eventsOf(run, EventKind.Cast).map((k) => run.events.a[k]);
}

describe("seismic echo", () => {
  it("follows each hero cast", () => {
    const data = quietData();
    const { echo } = params(data);
    const run = abilityRun("stonehorn", { 0: 1, 2: 1 }, data);
    const e = addEnemy(run, 0, -200);
    run.step(NO_INPUT);
    expect(castSlots(run).sort()).toEqual([0, 2]);
    const casts = eventsOf(run, EventKind.Cast);
    const echoCast = casts.find((k) => run.events.a[k] === 2)!;
    expect(run.events.value[echoCast]).toBe(echo.radius[0]);
    const spell = eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 1 && run.events.v[k] === 2);
    expect(spell.length).toBe(1);
    expect(run.events.a[spell[0]]).toBe(e);
    expect(run.events.value[spell[0]]).toBeCloseTo(echo.damage[0] * run.hero.stats.spellPower, 9);
    expect(run.enemies.stunTicks[e]).toBeGreaterThanOrEqual(Math.round(echo.stunSeconds[0] * 30) - 1);
  });

  it("does not trigger itself", () => {
    const run = abilityRun("stonehorn", { 0: 1, 2: 1 });
    addEnemy(run, 0, -200);
    run.step(NO_INPUT);
    expect(castSlots(run).filter((s) => s === 2).length).toBe(1);
    expect(run.abilities[2].cooldown).toBe(0);
  });

  it("stays silent when not learned", () => {
    const run = abilityRun("stonehorn", { 0: 1 });
    addEnemy(run, 0, -200);
    run.step(NO_INPUT);
    expect(castSlots(run)).toEqual([0]);
  });
});
