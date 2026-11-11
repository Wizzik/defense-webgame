import { describe, expect, it } from "vitest";
import { armorReduction } from "./combat";
import { Role } from "./enemies";
import { Charge } from "./enemy-charge";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { distance, enemyRun, eventsOf, heroDistance, heroHits, place, typeOf, type EnemyRun } from "./testing/enemy-run";

const CHARGE = { minRange: 300, maxRange: 700, windupSeconds: 0.5, speedMultiplier: 2.5, damageMultiplier: 2, distance: 900, cooldownSeconds: 6 };
const WINDUP_TICKS = 15;
const COOLDOWN_TICKS = 180;
const DAMAGE = 40;

function chargeRun() {
  return enemyRun((d) => {
    const lancer = d.enemies.find((e) => e.id === "lancer")!;
    lancer.charge = { ...CHARGE };
    lancer.moveSpeed = 360;
    lancer.attack.damageMin = DAMAGE;
    lancer.attack.damageMax = DAMAGE;
  });
}

const step = (run: EnemyRun, n = 1) => {
  for (let i = 0; i < n; i++) run.step(NO_INPUT);
};
const RUN_STEP = (360 * CHARGE.speedMultiplier) / 30;

/** Steps through the windup; returns after the first step of the run. */
function throughWindup(run: EnemyRun, lancer: number): void {
  step(run, WINDUP_TICKS + 1);
  expect(run.enemies.chargeState[lancer]).toBe(Charge.Run);
}

describe("lancer charge", () => {
  it("a lancer winds up, then charges in a straight line", () => {
    const run = chargeRun();
    const l = place(run, "lancer", Role.Hunter, 500, 0);
    const e = run.enemies;
    for (let i = 0; i < WINDUP_TICKS; i++) {
      step(run);
      expect(e.chargeState[l]).toBe(Charge.Windup);
      expect(e.x[l]).toBe(500);
      expect(e.y[l]).toBe(0);
    }
    for (let i = 1; i <= 3; i++) {
      step(run);
      expect(e.chargeState[l]).toBe(Charge.Run);
      expect(e.x[l]).toBeCloseTo(500 - i * RUN_STEP, 9);
      expect(e.y[l]).toBe(0);
    }
  });

  it("a charge hit deals multiplied damage and ends", () => {
    const run = chargeRun();
    const l = place(run, "lancer", Role.Hunter, 500, 0);
    const e = run.enemies;
    const before = run.hero.hp;
    let hits = 0;
    for (let i = 0; i < 60 && hits === 0; i++) {
      step(run);
      hits = heroHits(run, l);
    }
    expect(hits).toBe(1);
    const k = 1 - armorReduction(run.hero.stats.armor, run.data.constants.defenseArmor);
    const hit = eventsOf(run, EventKind.HeroHit)[0]!;
    expect(run.events.value[hit]).toBeCloseTo(DAMAGE * CHARGE.damageMultiplier * k, 9);
    expect(before - run.hero.hp).toBeCloseTo(DAMAGE * CHARGE.damageMultiplier * k, 0); // the hero regenerates a little
    expect(e.chargeState[l]).toBe(Charge.None);
    expect(e.chargeCooldown[l]).toBe(COOLDOWN_TICKS);
    expect(e.lastAttackTick[l]).toBe(run.tick - 1);
    // the hit used the attack: the next steps bring no second hit
    for (let i = 0; i < 10; i++) {
      step(run);
      expect(heroHits(run, l)).toBe(0);
    }
  });

  it("a charge that misses ends after its distance", () => {
    const run = chargeRun();
    const l = place(run, "lancer", Role.Hunter, 500, 0);
    const e = run.enemies;
    throughWindup(run, l);
    run.hero.y += 600; // the hero steps out of the line
    let steps = 1;
    while (e.chargeState[l] === Charge.Run) {
      step(run);
      steps++;
      expect(heroHits(run, l)).toBe(0);
      expect(e.y[l]).toBe(0);
      expect(steps).toBeLessThan(100);
    }
    const travelled = 500 - e.x[l]!;
    expect(travelled).toBeGreaterThan(CHARGE.distance - RUN_STEP);
    expect(travelled).toBeLessThanOrEqual(CHARGE.distance + RUN_STEP);
    expect(e.chargeCooldown[l]).toBe(COOLDOWN_TICKS);
    // then it walks at its normal speed towards the hero
    const d0 = heroDistance(run, l);
    step(run, 10);
    expect(e.chargeState[l]).toBe(Charge.None);
    expect(d0 - heroDistance(run, l)).toBeCloseTo((360 * 10) / 30, 6);
  });

  it("a stun cancels the charge", () => {
    for (const stunAfter of [5, WINDUP_TICKS + 3]) {
      const run = chargeRun();
      const l = place(run, "lancer", Role.Hunter, 500, 0);
      const e = run.enemies;
      step(run, stunAfter);
      expect(e.chargeState[l]).not.toBe(Charge.None);
      e.stunTicks[l] = 10;
      const x = e.x[l];
      step(run);
      expect(e.chargeState[l]).toBe(Charge.None);
      expect(e.chargeCooldown[l]).toBe(COOLDOWN_TICKS);
      expect(e.x[l]).toBe(x);
      step(run, 20);
      expect(e.chargeState[l]).toBe(Charge.None);
    }
  });

  it("no charge outside the range or on cooldown", () => {
    const far = chargeRun();
    const a = place(far, "lancer", Role.Hunter, 800, 0);
    step(far);
    expect(far.enemies.chargeState[a]).toBe(Charge.None);
    expect(far.enemies.x[a]).toBeCloseTo(800 - 12, 9);
    step(far, 12);
    expect(far.enemies.chargeState[a]).toBe(Charge.Windup); // it walked into the range

    const near = chargeRun();
    const b = place(near, "lancer", Role.Hunter, 200, 0);
    step(near, 5);
    expect(near.enemies.chargeState[b]).toBe(Charge.None);

    const cooling = chargeRun();
    const c = place(cooling, "lancer", Role.Hunter, 600, 0);
    cooling.enemies.chargeCooldown[c] = 100;
    step(cooling, 5);
    expect(cooling.enemies.chargeState[c]).toBe(Charge.None);
    expect(cooling.enemies.chargeCooldown[c]).toBe(95);
  });

  it("a lancer in a sieger pack walks to the castle", () => {
    const run = chargeRun();
    const l = place(run, "lancer", Role.Sieger, 500, 0);
    const { castle } = run;
    const before = distance(500, 0, castle.x, castle.y);
    for (let i = 0; i < 30; i++) {
      step(run);
      expect(run.enemies.chargeState[l]).toBe(Charge.None);
    }
    expect(before - distance(run.enemies.x[l]!, run.enemies.y[l]!, castle.x, castle.y)).toBeCloseTo(360, 6);
  });

  it("EnemyCharge carries slot, phase, position and direction", () => {
    const run = chargeRun();
    place(run, "shieldbearer", Role.Sieger, 5000, 5000);
    const l = place(run, "lancer", Role.Hunter, 300, 400);
    const ev = run.events;
    step(run);
    const windup = eventsOf(run, EventKind.EnemyCharge);
    expect(windup).toHaveLength(1);
    expect([ev.a[windup[0]!], ev.value[windup[0]!], ev.x[windup[0]!], ev.y[windup[0]!]]).toEqual([l, 0, 300, 400]);
    expect(ev.u[windup[0]!]).toBeCloseTo(-0.6, 12);
    expect(ev.v[windup[0]!]).toBeCloseTo(-0.8, 12);
    step(run, WINDUP_TICKS - 2);
    expect(eventsOf(run, EventKind.EnemyCharge)).toHaveLength(0);
    run.hero.x = 300; // the direction locks where the hero is when the windup ends
    run.hero.y = 0;
    step(run);
    expect(eventsOf(run, EventKind.EnemyCharge)).toHaveLength(0);
    step(run);
    const go = eventsOf(run, EventKind.EnemyCharge);
    expect(go).toHaveLength(1);
    expect([ev.a[go[0]!], ev.value[go[0]!], ev.x[go[0]!], ev.y[go[0]!]]).toEqual([l, 1, 300, 400]);
    expect(ev.u[go[0]!]).toBeCloseTo(0, 12);
    expect(ev.v[go[0]!]).toBeCloseTo(-1, 12);
    expect(run.enemies.y[l]).toBeCloseTo(400 - RUN_STEP, 9);
  });

  it("a charge stops at the arena edge", () => {
    const run = chargeRun();
    const edge = run.data.rules.arena.width / 2;
    run.hero.x = edge - 100;
    const l = place(run, "lancer", Role.Hunter, edge - 600, 0);
    const e = run.enemies;
    throughWindup(run, l);
    run.hero.y += 600;
    let steps = 0;
    while (e.chargeState[l] === Charge.Run) {
      step(run);
      steps++;
      expect(steps).toBeLessThan(100);
    }
    const collision = run.data.enemies[typeOf(run, "lancer")]!.collision;
    expect(e.x[l]).toBe(edge - collision);
    expect(steps).toBeLessThan(CHARGE.distance / RUN_STEP - 5);
    expect(e.chargeCooldown[l]).toBe(COOLDOWN_TICKS);
  });
});
