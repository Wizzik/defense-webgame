import { describe, expect, it } from "vitest";
import { AllyKind } from "./allies";
import { armorReduction, killEnemy, stunEnemy } from "./combat";
import { Action, Role } from "./enemies";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { spawnBoss } from "./timeline";
import { countEvents, enemyRun, eventsOf, type EnemyRun, place, typeOf } from "./testing/enemy-run";

const WINDUP = 30;
const RADIUS = 350;
const DAMAGE = 120;

/** An Iron Marshal at (x, y) whose slam is ready and whose own attack never comes. */
function boss(run: EnemyRun, role: number, x: number, y: number): number {
  const slot = spawnBoss(run, typeOf(run, "iron-marshal"), role);
  const e = run.enemies;
  e.x[slot] = x;
  e.y[slot] = y;
  e.slamCooldown[slot] = 0;
  e.attackCooldown[slot] = 1_000_000;
  e.chargeCooldown[slot] = 1_000_000;
  return slot;
}

const step = (run: EnemyRun, n = 1) => {
  for (let i = 0; i < n; i++) run.step(NO_INPUT);
};

function slamEvents(run: EnemyRun): { value: number; x: number; y: number; u: number; v: number; a: number }[] {
  const ev = run.events;
  return eventsOf(run, EventKind.Slam).map((k) => ({ a: ev.a[k]!, value: ev.value[k]!, x: ev.x[k]!, y: ev.y[k]!, u: ev.u[k]!, v: ev.v[k]! }));
}

describe("boss slam", () => {
  it("a fresh boss waits the shortest cooldown before its first slam", () => {
    const run = enemyRun();
    const slot = spawnBoss(run, typeOf(run, "iron-marshal"), Role.Hunter);
    expect(run.enemies.slamCooldown[slot]).toBe(7 * 30);
    expect(run.enemies.slamState[slot]).toBe(0);
  });

  it("a slam warns for the windup, then hits a hero inside the circle", () => {
    const run = enemyRun();
    const b = boss(run, Role.Hunter, 200, 0);
    run.enemies.damageScale[b] = 1.5;
    step(run);
    expect(slamEvents(run)).toEqual([{ a: b, value: 0, x: 200, y: 0, u: RADIUS, v: WINDUP }]);
    expect(run.enemies.slamState[b]).toBe(1);
    for (let i = 0; i < WINDUP - 1; i++) {
      step(run);
      expect(slamEvents(run)).toEqual([]);
      expect(countEvents(run, EventKind.HeroHit)).toBe(0);
      expect(run.enemies.action[b]).toBe(Action.Attack);
      expect(run.enemies.x[b]).toBe(200); // it stands while it winds up
    }
    step(run);
    expect(slamEvents(run).map((s) => s.value)).toEqual([1]);
    const hits = eventsOf(run, EventKind.HeroHit);
    expect(hits).toHaveLength(1);
    const k = 1 - armorReduction(run.hero.stats.armor, run.data.constants.defenseArmor);
    expect(run.events.value[hits[0]!]).toBeCloseTo(DAMAGE * 1.5 * k, 9);
    expect(run.events.a[hits[0]!]).toBe(b);
    expect(run.enemies.slamState[b]).toBe(0);
  });

  it("no slam starts while the hero and the castle are out of reach", () => {
    const run = enemyRun();
    const b = boss(run, Role.Hunter, RADIUS * 0.8 + 400, 0);
    run.data.enemies[run.enemies.type[b]!]!.moveSpeed = 0.0001;
    step(run, 5);
    expect(run.enemies.slamState[b]).toBe(0);
  });

  it("a hero who leaves the circle is not hit", () => {
    const run = enemyRun();
    const b = boss(run, Role.Hunter, 200, 0);
    step(run);
    run.hero.x = 200 + RADIUS + 1;
    let ended = 0;
    for (let i = 0; i < WINDUP; i++) {
      step(run);
      run.hero.x = 200 + RADIUS + 1;
      expect(countEvents(run, EventKind.HeroHit)).toBe(0);
      ended += slamEvents(run).filter((s) => s.value === 1).length;
    }
    expect(ended).toBe(1);
    expect(run.enemies.slamState[b]).toBe(0);
  });

  it("a slam next to the castle hits the castle", () => {
    const run = enemyRun();
    const { castle } = run;
    const b = boss(run, Role.Sieger, castle.x + castle.radius + 80 + 50, castle.y);
    const hpBefore = castle.hp;
    step(run);
    expect(slamEvents(run).map((s) => s.value)).toEqual([0]);
    step(run, WINDUP);
    const hits = eventsOf(run, EventKind.CastleHit);
    expect(hits).toHaveLength(1);
    expect(run.events.value[hits[0]!]).toBe(DAMAGE);
    expect(castle.hp).toBe(hpBefore - DAMAGE);
    expect(countEvents(run, EventKind.HeroHit)).toBe(0);
    expect(run.enemies.slamState[b]).toBe(0);
  });

  it("allies are not hit", () => {
    const run = enemyRun();
    boss(run, Role.Hunter, 200, 0);
    const ally = run.allies.spawn(AllyKind.Ward, 0, 0, 150, 0, 0, 100000);
    step(run, WINDUP + 1);
    expect(countEvents(run, EventKind.HeroHit)).toBe(1);
    expect(run.allies.alive[ally]).toBe(1);
  });

  it("a stun cancels the slam and starts the cooldown", () => {
    const run = enemyRun();
    const b = boss(run, Role.Hunter, 200, 0);
    step(run);
    stunEnemy(run, b, 60);
    step(run);
    expect(slamEvents(run).map((s) => s.value)).toEqual([2]);
    expect(run.enemies.slamState[b]).toBe(0);
    expect(run.enemies.slamCooldown[b]).toBeGreaterThanOrEqual(7 * 30 - 1);
    for (let i = 0; i < WINDUP + 20; i++) {
      step(run);
      expect(countEvents(run, EventKind.HeroHit)).toBe(0);
      expect(slamEvents(run)).toEqual([]);
    }
  });

  it("a boss that dies in the windup hits nobody", () => {
    const run = enemyRun();
    const b = boss(run, Role.Hunter, 200, 0);
    step(run);
    run.events.clear();
    killEnemy(run, b);
    expect(slamEvents(run)).toEqual([{ a: b, value: 2, x: 200, y: 0, u: RADIUS, v: 0 }]);
    for (let i = 0; i < WINDUP + 5; i++) {
      step(run);
      expect(countEvents(run, EventKind.HeroHit)).toBe(0);
    }
  });

  it("a boss that is not slamming dies without a slam event", () => {
    const run = enemyRun();
    const b = boss(run, Role.Hunter, 2000, 0);
    run.events.clear();
    killEnemy(run, b);
    expect(slamEvents(run)).toEqual([]);
  });

  it("the shield blocks a slam", () => {
    const run = enemyRun();
    boss(run, Role.Hunter, 200, 0);
    run.shieldTicks = 1000;
    const hp = run.hero.hp;
    let landed = 0;
    for (let i = 0; i < WINDUP + 1; i++) {
      step(run);
      landed += slamEvents(run).filter((s) => s.value === 1).length;
      expect(countEvents(run, EventKind.HeroHit)).toBe(0);
    }
    expect(landed).toBe(1);
    expect(run.hero.hp).toBeGreaterThanOrEqual(hp);
  });

  it("the cooldown is between 7 and 15 s and deterministic for a seed", () => {
    const cooldownAfterSlam = () => {
      const run = enemyRun();
      const b = boss(run, Role.Hunter, 200, 0);
      step(run, WINDUP + 1);
      return run.enemies.slamCooldown[b]!;
    };
    const first = cooldownAfterSlam();
    expect(first).toBeGreaterThanOrEqual(7 * 30);
    expect(first).toBeLessThanOrEqual(15 * 30);
    expect(first % 30).not.toBe(0); // a random value, not one of the bounds
    expect(cooldownAfterSlam()).toBe(first);
  });

  it("the cooldown scales with run.slamCooldownScale", () => {
    const cooldown = (scale: number) => {
      const run = enemyRun();
      const b = boss(run, Role.Hunter, 200, 0);
      run.slamCooldownScale = scale;
      step(run, WINDUP + 1);
      return run.enemies.slamCooldown[b]!;
    };
    expect(cooldown(0.5)).toBe(Math.round(cooldown(1) / 2));
  });

  it("a boss is stunned for a quarter of the time", () => {
    const run = enemyRun();
    const b = boss(run, Role.Hunter, 2000, 0);
    const common = place(run, "shieldbearer", Role.Hunter, 2000, 500);
    stunEnemy(run, b, 60);
    stunEnemy(run, common, 60);
    expect(run.enemies.stunTicks[b]).toBe(15);
    expect(run.enemies.stunTicks[common]).toBe(60);
    stunEnemy(run, b, 20); // 5 ticks: the longer stun stays
    expect(run.enemies.stunTicks[b]).toBe(15);
    stunEnemy(run, b, 0);
    expect(run.enemies.stunTicks[b]).toBe(15);
    stunEnemy(run, b, 61); // ceil(15.25)
    expect(run.enemies.stunTicks[b]).toBe(16);
  });
});
