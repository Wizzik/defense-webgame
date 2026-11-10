import { describe, expect, it } from "vitest";
import { armorReduction } from "./combat";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { updateHeroCombat } from "./hero";
import { NO_INPUT } from "./input";
import { stateHash } from "./hash";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

const REDUCTION = 0.06 / 1.06;

function newRun() {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2000 }, heroStart: { x: 0, y: 1500 },
    gates: [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }], gateRadius: 150,
  };
  data.rules.hero = {
    collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01,
    dash: { distance: 350, seconds: 0.15, cooldownSeconds: 4 },
  };
  // The attack tests count ticks, so the base attack cooldown is pinned.
  for (const hero of data.heroes) hero.baseAttack.cooldown = 1.5;
  data.rules.castle.hp = 3000;
  data.rules.phases[0].spawnPerSecond = 0;
  data.constants.defenseArmor = 0.02;
  const e = data.enemies[0];
  e.collision = 31;
  e.armor = 3;
  return createRun(data, { seed: 5, durationSeconds: 100000 });
}

type TestRun = ReturnType<typeof newRun>;

/** Spawns an enemy `dx` east of the hero (y equal), with plenty of hp. */
function add(run: TestRun, role: number, dx: number, hp = 100000): number {
  return run.enemies.spawn(0, role, 0, run.hero.x + dx, run.hero.y, hp, 1, 0);
}

function hits(run: TestRun): number[] {
  const out: number[] = [];
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === EventKind.Hit) out.push(k);
  return out;
}

describe("hero combat", () => {
  it("hero attacks the nearest enemy in reach", () => {
    const run = newRun();
    add(run, Role.Hunter, 180);
    const near = add(run, Role.Hunter, 100);
    add(run, Role.Hunter, 120);
    add(run, Role.Hunter, 192); // 32 + 31 + 128 = 191: just out of reach
    updateHeroCombat(run);
    const h = hits(run);
    expect(h.length).toBe(1);
    expect(run.events.a[h[0]]).toBe(near);
    expect(run.events.x[h[0]]).toBe(run.enemies.x[near]);
    expect(run.events.y[h[0]]).toBe(run.enemies.y[near]);
    expect(run.events.u[h[0]]).toBe(0);
    expect(run.events.value[h[0]]).toBeGreaterThan(0);
    expect(run.enemies.lastHitTick[near]).toBe(run.tick);
    expect(run.hero.attackCooldown).toBe(43);
    expect(run.hero.facingX).toBeCloseTo(1, 9);
    expect(run.hero.facingY).toBeCloseTo(0, 9);
  });

  it("equal distance goes to the lower slot", () => {
    const run = newRun();
    const a = add(run, Role.Hunter, 100);
    run.enemies.spawn(0, Role.Hunter, 0, run.hero.x - 100, run.hero.y, 1000, 1, 0);
    updateHeroCombat(run);
    expect(run.events.a[hits(run)[0]]).toBe(a);
  });

  it("does not attack out of reach and keeps a moving hero's facing", () => {
    const run = newRun();
    add(run, Role.Hunter, 400);
    updateHeroCombat(run);
    expect(run.events.count).toBe(0);
    expect(run.hero.attackCooldown).toBe(0);
    const near = add(run, Role.Hunter, 100);
    run.hero.moving = true;
    updateHeroCombat(run);
    expect(run.events.a[hits(run)[0]]).toBe(near);
    expect(run.hero.facingX).toBe(0);
    expect(run.hero.facingY).toBe(1);
  });

  it("attack interval follows agility", () => {
    const run = newRun();
    const s = add(run, Role.Hunter, 100);
    run.enemies.stunTicks[s] = 100000;
    let count = 0;
    for (let i = 0; i < 300; i++) {
      run.events.clear();
      updateHeroCombat(run);
      count += hits(run).length;
      run.tick++;
    }
    expect(count).toBe(7);
  });

  it("armorReduction matches the map formula", () => {
    expect(armorReduction(3, 0.02)).toBeCloseTo(0.06 / 1.06, 12);
    expect(armorReduction(0, 0.02)).toBe(0);
    expect(armorReduction(-4, 0.02)).toBe(0);
  });

  it("damage uses the primary attribute", () => {
    const run = newRun();
    add(run, Role.Hunter, 100);
    const seen: number[] = [];
    for (let i = 0; i < 200; i++) {
      run.events.clear();
      run.hero.attackCooldown = 0;
      updateHeroCombat(run);
      seen.push(run.events.value[hits(run)[0]]);
    }
    for (const v of seen) {
      expect(v).toBeGreaterThanOrEqual(37 * (1 - REDUCTION) - 1e-9);
      expect(v).toBeLessThanOrEqual(47 * (1 - REDUCTION) + 1e-9);
    }
    expect(Math.min(...seen)).toBeLessThan(Math.max(...seen));
    expect(run.stats.damageDealt).toBeCloseTo(seen.reduce((a, b) => a + b, 0), 6);
  });

  it("kills count and emit Death", () => {
    const run = newRun();
    const s = add(run, Role.Hunter, 100, 1);
    const x = run.enemies.x[s];
    updateHeroCombat(run);
    expect(run.events.kind[0]).toBe(EventKind.Hit);
    expect(run.events.kind[1]).toBe(EventKind.Death);
    expect(run.events.a[1]).toBe(s);
    expect(run.events.x[1]).toBe(x);
    expect(run.events.y[1]).toBe(run.hero.y);
    expect(run.stats.kills).toBe(1);
    expect(run.enemies.alive[s]).toBe(0);
    expect(run.enemies.aliveCount).toBe(0);
    expect(run.stats.damageDealt).toBe(1); // overkill does not count
    expect(run.events.value[0]).toBeGreaterThan(1);
  });

  it("hit siegers aggro on the hero", () => {
    const run = newRun();
    const s = add(run, Role.Sieger, 100);
    expect(run.enemies.aggro[s]).toBe(0);
    updateHeroCombat(run);
    expect(run.enemies.aggro[s]).toBe(1);
  });

  it("hero regenerates up to max hp", () => {
    const run = newRun();
    const { maxHp, regenPerSecond } = run.hero.stats;
    run.hero.hp = maxHp - 10;
    updateHeroCombat(run);
    expect(run.hero.hp).toBeCloseTo(maxHp - 10 + regenPerSecond / 30, 9);
    run.hero.hp = maxHp - 0.001;
    updateHeroCombat(run);
    expect(run.hero.hp).toBe(maxHp);
    run.hero.hp = 0;
    updateHeroCombat(run);
    expect(run.hero.hp).toBe(0);
  });

  it("hero at 0 hp loses the run", () => {
    const run = newRun();
    run.hero.hp = 0;
    run.step(NO_INPUT);
    expect(run.state).toBe("lost");
    expect(run.result).toBe("hero");
    const last = run.events.count - 1;
    expect(run.events.kind[last]).toBe(EventKind.RunEnd);
    expect(run.events.a[last]).toBe(2);
  });

  it("castle loss wins a tie", () => {
    const run = newRun();
    run.hero.hp = 0;
    run.castle.hp = 0;
    run.step(NO_INPUT);
    expect(run.result).toBe("castle");
    const last = run.events.count - 1;
    expect(run.events.a[last]).toBe(1);
  });

  it("state hash covers hero hp, attack cooldown and kills", () => {
    const run = newRun();
    const base = stateHash(run);
    run.hero.hp -= 1;
    const afterHp = stateHash(run);
    expect(afterHp).not.toBe(base);
    run.hero.attackCooldown = 5;
    const afterCd = stateHash(run);
    expect(afterCd).not.toBe(afterHp);
    run.stats.kills = 1;
    expect(stateHash(run)).not.toBe(afterCd);
  });
});
