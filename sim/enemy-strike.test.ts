import { describe, expect, it } from "vitest";
import { armorReduction, killEnemy, stunEnemy } from "./combat";
import { Role } from "./enemies";
import { Slam, SlamEvent } from "./enemy-slam";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { spawnBoss } from "./timeline";
import { distance, enemyRun, eventsOf, type EnemyRun, place, typeOf } from "./testing/enemy-run";

const WINDUP = 30;
/** Iron Marshal: strike radius, damage and cooldown of design/enemies.yaml. */
const RADIUS = 260;
const DAMAGE = 150;
const COOLDOWN = 6 * 30;

/** A boss of type `id` at (x, y) whose strike is ready and whose slam, charge and own attack never come. */
function boss(run: EnemyRun, id: string, role: number, x: number, y: number): number {
  const slot = spawnBoss(run, typeOf(run, id), role);
  const e = run.enemies;
  e.x[slot] = x;
  e.y[slot] = y;
  e.strikeCooldown[slot] = 0;
  e.slamCooldown[slot] = 1_000_000;
  e.attackCooldown[slot] = 1_000_000;
  e.chargeCooldown[slot] = 1_000_000;
  return slot;
}

const step = (run: EnemyRun, n = 1) => {
  for (let i = 0; i < n; i++) run.step(NO_INPUT);
};

function slamEvents(run: EnemyRun): { a: number; value: number; x: number; y: number; u: number; v: number }[] {
  const ev = run.events;
  return eventsOf(run, EventKind.Slam).map((k) => ({ a: ev.a[k]!, value: ev.value[k]!, x: ev.x[k]!, y: ev.y[k]!, u: ev.u[k]!, v: ev.v[k]! }));
}

const heroDamage = (run: EnemyRun): number => {
  const ev = run.events;
  return eventsOf(run, EventKind.HeroHit).reduce((sum, k) => sum + ev.value[k]!, 0);
};

describe("boss strike from afar", () => {
  it("a fresh boss waits one cooldown before its first strike", () => {
    const run = enemyRun();
    const slot = spawnBoss(run, typeOf(run, "iron-marshal"), Role.Hunter);
    expect(run.enemies.strikeCooldown[slot]).toBe(COOLDOWN);
  });

  it("warns with a circle on the hero, leaps into it and hits a hero who stayed", () => {
    const run = enemyRun();
    const b = boss(run, "iron-marshal", Role.Hunter, 800, 0);
    run.enemies.damageScale[b] = 1.5;
    step(run);
    expect(slamEvents(run)).toEqual([{ a: b, value: SlamEvent.Warning, x: 0, y: 0, u: RADIUS, v: WINDUP }]);
    expect(run.enemies.slamState[b]).toBe(Slam.Strike);
    step(run, WINDUP - 1);
    expect(heroDamage(run)).toBe(0);
    step(run);
    expect(slamEvents(run).map((s) => s.value)).toEqual([SlamEvent.Hit]);
    const k = 1 - armorReduction(run.hero.stats.armor, run.data.constants.defenseArmor);
    expect(heroDamage(run)).toBeCloseTo(DAMAGE * 1.5 * k, 6);
    // the boss landed next to the hero (their circles touch)
    expect(distance(run.enemies.x[b]!, run.enemies.y[b]!, 0, 0)).toBeLessThan(80 + 32 + 5);
    expect(run.enemies.slamState[b]).toBe(Slam.None);
    expect(run.enemies.strikeCooldown[b]).toBe(COOLDOWN);
  });

  it("misses a hero who left the circle", () => {
    const run = enemyRun();
    const b = boss(run, "iron-marshal", Role.Hunter, 800, 0);
    step(run);
    run.hero.x = 0;
    run.hero.y = RADIUS + 10;
    step(run, WINDUP);
    expect(heroDamage(run)).toBe(0);
    // the circle stayed where the hero stood when the warning began
    expect(distance(run.enemies.x[b]!, run.enemies.y[b]!, 0, 0)).toBeLessThan(5);
  });

  it("does not start outside its range, on cooldown, or for a sieger that does not see the hero", () => {
    const far = enemyRun();
    boss(far, "iron-marshal", Role.Hunter, 1400, 0);
    const near = enemyRun();
    boss(near, "iron-marshal", Role.Hunter, 400, 0);
    const waiting = enemyRun();
    const w = boss(waiting, "iron-marshal", Role.Hunter, 800, 0);
    waiting.enemies.strikeCooldown[w] = 100;
    const sieger = enemyRun();
    boss(sieger, "iron-marshal", Role.Sieger, 800, 0);
    for (const run of [far, near, waiting, sieger]) {
      step(run);
      expect(slamEvents(run)).toEqual([]);
    }
  });

  it("a boss without `leap` stands and the shot lands on the hero's spot", () => {
    const run = enemyRun();
    const b = boss(run, "gunmaster", Role.Hunter, 1000, 0);
    step(run);
    expect(slamEvents(run).map((s) => [s.value, s.x, s.y, s.u])).toEqual([[SlamEvent.Warning, 0, 0, 240]]);
    step(run, WINDUP);
    expect(run.enemies.x[b]).toBe(1000);
    expect(heroDamage(run)).toBeGreaterThan(0);
  });

  it("a stun cancels the warning and starts the cooldown", () => {
    const run = enemyRun();
    const b = boss(run, "iron-marshal", Role.Hunter, 800, 0);
    step(run, 5);
    stunEnemy(run, b, 4);
    step(run);
    expect(slamEvents(run).map((s) => [s.value, s.u])).toEqual([[SlamEvent.Cancelled, RADIUS]]);
    expect(run.enemies.slamState[b]).toBe(Slam.None);
    expect(run.enemies.strikeCooldown[b]).toBe(COOLDOWN);
    step(run, WINDUP);
    expect(heroDamage(run)).toBe(0);
  });

  it("a boss that dies in the warning takes its circle with it", () => {
    const run = enemyRun();
    const b = boss(run, "iron-marshal", Role.Hunter, 800, 0);
    step(run, 3);
    run.events.clear();
    killEnemy(run, b);
    expect(slamEvents(run).map((s) => [s.value, s.u])).toEqual([[SlamEvent.Cancelled, RADIUS]]);
  });

  it("a slam is not started right after the landing", () => {
    const run = enemyRun();
    const b = boss(run, "iron-marshal", Role.Hunter, 800, 0);
    run.enemies.slamCooldown[b] = 0;
    step(run, WINDUP + 1);
    expect(run.enemies.slamState[b]).toBe(Slam.None);
    expect(run.enemies.slamCooldown[b]).toBeGreaterThan(30);
  });
});

describe("hunter types", () => {
  it("an elite placed as a sieger walks to the hero, not to the castle", () => {
    const run = enemyRun();
    const c = place(run, "captain", Role.Sieger, 2000, 0);
    run.enemies.chargeCooldown[c] = 1_000_000;
    step(run, 30);
    expect(run.enemies.x[c]).toBeLessThan(2000 - 100);
    expect(Math.abs(run.enemies.y[c]!)).toBeLessThan(1);
  });
});
