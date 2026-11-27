import { describe, expect, it } from "vitest";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, addEnemy, eventsOf, quietData } from "../testing/ability-run";

const SLOT = 1; // the Serpent Shaman's forked bolt; slot 0 (a summon) is switched off

function coneRun(maxTargets?: number) {
  const data = quietData();
  const ab = data.abilities.find((a) => a.id === "forked-bolt");
  if (!ab || ab.kind !== "cone") throw new Error("test setup");
  if (maxTargets !== undefined) ab.params.maxTargets = ab.params.maxTargets.map(() => maxTargets);
  return { run: abilityRun("serpent-shaman", { [SLOT]: 1 }, data), p: ab.params };
}

function hitSlots(run: ReturnType<typeof abilityRun>): number[] {
  return eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 1).map((k) => run.events.a[k]);
}

describe("cone", () => {
  it("hits up to maxTargets nearest first", () => {
    const { run, p } = coneRun(2);
    const a = addEnemy(run, 0, 200);
    const b = addEnemy(run, 0, 400);
    const c = addEnemy(run, 0, 600);
    run.step(NO_INPUT);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts.length).toBe(1);
    expect(run.events.value[casts[0]]).toBe(p.length[0]);
    expect(run.events.u[casts[0]]).toBeCloseTo(0, 9);
    expect(run.events.v[casts[0]]).toBeCloseTo(1, 9);
    const hits = hitSlots(run);
    expect(hits.sort()).toEqual([a, b].sort());
    expect(hits).not.toContain(c);
    // the spell's hit (u = 1), not the shaman's own shot at the nearest enemy
    const k = eventsOf(run, EventKind.Hit).find((i) => run.events.a[i] === a && run.events.u[i] === 1)!;
    expect(run.events.value[k]).toBeCloseTo(p.damage[0] * run.hero.stats.spellPower, 9);
  });

  it("misses enemies behind or outside the cone", () => {
    const { run } = coneRun();
    // two in a row ahead: the cone aims at them, the densest line (Petr, batch 2)
    const lead = addEnemy(run, 0, 300);
    const second = addEnemy(run, 0, 340);
    const behind = addEnemy(run, 0, -200);
    const outside = addEnemy(run, 400, 500);
    run.step(NO_INPUT);
    const hits = hitSlots(run);
    expect(hits).toContain(lead);
    expect(hits).toContain(second);
    expect(hits).not.toContain(behind);
    expect(hits).not.toContain(outside);
  });

  it("width grows with distance", () => {
    const { run } = coneRun();
    addEnemy(run, 0, 50);
    // half width 60 at the hero, endWidth / 2 at the far end, plus the enemy's collision
    const far = addEnemy(run, 98, 800);
    const near = addEnemy(run, 98, 100);
    run.step(NO_INPUT);
    const hits = hitSlots(run);
    expect(hits).toContain(far);
    expect(hits).not.toContain(near);
  });
});
