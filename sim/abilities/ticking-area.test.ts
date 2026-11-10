import { describe, expect, it } from "vitest";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { stateHash } from "../hash";
import { abilityRun, addEnemy, eventsOf, quietData } from "../testing/ability-run";

function params(data: ReturnType<typeof quietData>) {
  const ab = data.abilities.find((a) => a.id === "bone-stampede");
  if (ab?.kind !== "ticking_area") throw new Error("test setup");
  return ab.params;
}

/** Stepping `steps` times; returns [step index (1 = the cast step), event index] of every Blast. */
function collectBlasts(run: ReturnType<typeof abilityRun>, steps: number) {
  const out: { step: number; x: number; y: number }[] = [];
  for (let s = 1; s <= steps; s++) {
    run.step(NO_INPUT);
    for (const k of eventsOf(run, EventKind.Blast)) out.push({ step: s, x: run.events.x[k], y: run.events.y[k] });
  }
  return out;
}

describe("ticking area", () => {
  it("blasts tps times per second for its duration", () => {
    const data = quietData();
    const p = params(data);
    const run = abilityRun("gravecaller", { 3: 1 }, data);
    addEnemy(run, 300, 0);
    const blasts = collectBlasts(run, 400);
    expect(blasts.length).toBe(Math.floor(p.duration[0] * p.ticksPerSecond[0]));
    expect(Math.max(...blasts.map((b) => b.step))).toBeLessThanOrEqual(Math.round(p.duration[0] * 30));
    expect(run.abilities[3].active).toBe(false);
  });

  it("blasts stay within the radius around the hero", () => {
    const data = quietData();
    const p = params(data);
    const run = abilityRun("gravecaller", { 3: 1 }, data);
    addEnemy(run, 300, 0);
    const blasts = collectBlasts(run, 300);
    expect(blasts.length).toBeGreaterThan(0);
    for (const b of blasts) expect(b.x * b.x + b.y * b.y).toBeLessThanOrEqual(p.radius[0] * p.radius[0] + 1e-6);
  });

  it("blasts damage enemies within hitRadius", () => {
    const data = quietData();
    const p = params(data);
    p.radius = [1, 1];
    const run = abilityRun("gravecaller", { 3: 1 }, data);
    const e = addEnemy(run, 200, 0);
    run.ultimateRequested = true; // auto needs an enemy within radius 1; the blasts fall on the hero anyway
    const dmg = p.tickDamage[0] * run.hero.stats.spellPower;
    let blasts = 0;
    let hits = 0;
    for (let s = 0; s < 60; s++) {
      run.step(NO_INPUT);
      blasts += eventsOf(run, EventKind.Blast).length;
      for (const k of eventsOf(run, EventKind.Hit)) {
        if (run.events.u[k] !== 1 || run.events.a[k] !== e) continue;
        hits++;
        expect(run.events.value[k]).toBeCloseTo(dmg, 9);
      }
    }
    expect(blasts).toBeGreaterThan(0);
    expect(hits).toBe(blasts);
  });

  it("same seed gives the same blasts", () => {
    const hashes: number[] = [];
    for (let n = 0; n < 2; n++) {
      const run = abilityRun("gravecaller", { 3: 1 });
      addEnemy(run, 300, 0);
      collectBlasts(run, 200);
      hashes.push(stateHash(run));
    }
    expect(hashes[0]).toBe(hashes[1]);
  });
});
