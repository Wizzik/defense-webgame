import { describe, expect, it } from "vitest";
import { armorReduction } from "../combat";
import { EventKind } from "../events";
import { NO_INPUT } from "../input";
import { abilityRun, addEnemy, eventsOf, quietData } from "../testing/ability-run";
import { abilityCooldownTicks } from "./slots";

function totem(data: ReturnType<typeof quietData>) {
  const ab = data.abilities.find((a) => a.id === "enhanced-totem");
  if (!ab || ab.kind !== "on_hit") throw new Error("test setup");
  return { empower: ab.params.empower ?? [] };
}

/** Base attack hits (source 0) of the current step. */
function attackHits(run: ReturnType<typeof abilityRun>): number[] {
  return eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 0);
}

/** A Stonehorn with the totem at level 1, armed (one quiet step) and an enemy in attack reach. */
function armedRun(extra: Record<number, number> = {}) {
  const data = quietData();
  const run = abilityRun("stonehorn", { 1: 1, ...extra }, data);
  run.step(NO_INPUT);
  expect(run.abilities[1].active).toBe(true);
  const enemy = addEnemy(run, 40, 0);
  return { data, run, enemy };
}

describe("on_hit empowered strike", () => {
  it("charged attack deals 1 + empower times the damage", () => {
    const { data, run } = armedRun();
    const p = totem(data);
    const reduction = armorReduction(data.enemies[0].armor, data.constants.defenseArmor);
    const stats = run.hero.stats;
    const mult = 1 + p.empower[0];
    run.step(NO_INPUT);
    const first = attackHits(run);
    expect(first.length).toBe(1);
    const v = run.events.value[first[0]];
    expect(v).toBeGreaterThanOrEqual(Math.round(stats.damageMin) * mult * (1 - reduction) - 1e-9);
    expect(v).toBeLessThanOrEqual(Math.round(stats.damageMax) * mult * (1 - reduction) + 1e-9);
    expect(run.abilities[1].active).toBe(false);
    // The next attack is plain again.
    let next = -1;
    for (let i = 0; i < 200 && next < 0; i++) {
      run.step(NO_INPUT);
      const h = attackHits(run);
      if (h.length > 0) next = run.events.value[h[0]];
    }
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThanOrEqual(Math.round(stats.damageMax) * (1 - reduction) + 1e-9);
  });

  it("emits a Cast event with the multiplier at the attack target", () => {
    const { data, run, enemy } = armedRun();
    run.step(NO_INPUT);
    const casts = eventsOf(run, EventKind.Cast).filter((k) => run.events.a[k] === 1);
    expect(casts.length).toBe(1);
    expect(run.events.value[casts[0]]).toBe(1 + totem(data).empower[0]);
    expect(run.events.x[casts[0]]).toBe(run.enemies.x[enemy]);
    expect(run.events.y[casts[0]]).toBe(run.enemies.y[enemy]);
  });

  it("charge returns after the cooldown", () => {
    const { run } = armedRun();
    run.step(NO_INPUT);
    const slot = run.abilities[1];
    expect(slot.active).toBe(false);
    const ticks = abilityCooldownTicks(run, slot);
    expect(slot.cooldown).toBe(ticks - 1); // updateAbilities already counted this step
    let steps = 0;
    while (!slot.active && steps < ticks + 5) {
      run.step(NO_INPUT);
      steps++;
    }
    expect(slot.active).toBe(true);
    expect(steps).toBe(ticks - 1);
  });

  it("an empowered strike triggers the echo once", () => {
    const { run } = armedRun({ 2: 1 });
    run.step(NO_INPUT);
    const casts = eventsOf(run, EventKind.Cast);
    expect(casts.filter((k) => run.events.a[k] === 1).length).toBe(1);
    expect(casts.filter((k) => run.events.a[k] === 2).length).toBe(1);
  });
});

/** A Stonehorn whose totem is rewritten to the given on_hit params (level 1 learned), with an enemy in reach. */
function bonusRun(params: Record<string, number[]>) {
  const data = quietData();
  const ab = data.abilities.find((a) => a.id === "enhanced-totem");
  if (!ab || ab.kind !== "on_hit") throw new Error("test setup");
  ab.params = params;
  ab.cooldown = ab.cooldown.map(() => 0);
  const run = abilityRun("stonehorn", { 1: 1 }, data);
  const enemy = addEnemy(run, 40, 0);
  run.enemies.stunTicks[enemy] = 0;
  return { data, run, enemy };
}

/** Steps until the hero's next base attack lands; returns its event index. */
function nextAttack(run: ReturnType<typeof abilityRun>): number {
  for (let i = 0; i < 200; i++) {
    run.step(NO_INPUT);
    const hits = attackHits(run);
    if (hits.length > 0) return hits[0]!;
  }
  throw new Error("no attack");
}

describe("on_hit bonus damage", () => {
  const five = (n: number) => [n, n, n, n, n];

  it("a passive on_hit adds its bonus to every attack and never charges", () => {
    const { data, run } = bonusRun({ bonusDamage: five(500) });
    const k = 1 - armorReduction(data.enemies[0].armor, data.constants.defenseArmor);
    const stats = run.hero.stats;
    for (let attack = 0; attack < 3; attack++) {
      const v = run.events.value[nextAttack(run)]!;
      expect(v).toBeGreaterThanOrEqual((Math.round(stats.damageMin) + 500) * k - 1e-9);
      expect(v).toBeLessThanOrEqual((Math.round(stats.damageMax) + 500) * k + 1e-9);
      expect(run.abilities[1].active).toBe(false);
      expect(eventsOf(run, EventKind.Cast)).toHaveLength(0);
    }
  });

  it("an on_hit with a chance of 1 adds the bonus, stuns and reports a cast", () => {
    const { data, run, enemy } = bonusRun({ chance: five(1), bonusDamage: five(300), stunSeconds: five(2) });
    const k = 1 - armorReduction(data.enemies[0].armor, data.constants.defenseArmor);
    const v = run.events.value[nextAttack(run)]!;
    expect(v).toBeGreaterThanOrEqual((Math.round(run.hero.stats.damageMin) + 300) * k - 1e-9);
    expect(run.enemies.stunTicks[enemy]).toBe(60);
    expect(eventsOf(run, EventKind.Cast).map((c) => run.events.a[c])).toEqual([1]);
  });

  it("an on_hit with a chance of 0 never procs", () => {
    const { data, run, enemy } = bonusRun({ chance: five(0), bonusDamage: five(300), stunSeconds: five(2) });
    const k = 1 - armorReduction(data.enemies[0].armor, data.constants.defenseArmor);
    for (let attack = 0; attack < 3; attack++) {
      const v = run.events.value[nextAttack(run)]!;
      expect(v).toBeLessThanOrEqual(Math.round(run.hero.stats.damageMax) * k + 1e-9);
      expect(run.enemies.stunTicks[enemy]).toBe(0);
    }
  });

  it("a chance between 0 and 1 procs on a share of the attacks", () => {
    const { run, enemy } = bonusRun({ chance: five(0.5), stunSeconds: five(0.1) });
    let procs = 0;
    for (let attack = 0; attack < 60; attack++) {
      nextAttack(run);
      if (eventsOf(run, EventKind.Cast).length > 0) procs++;
      run.enemies.stunTicks[enemy] = 0;
    }
    expect(procs).toBeGreaterThan(15);
    expect(procs).toBeLessThan(45);
  });
});
