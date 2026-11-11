import { describe, expect, it } from "vitest";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { NO_INPUT } from "./input";
import { enemyRun, eventsOf, place, typeOf, type EnemyRun } from "./testing/enemy-run";

const AURA = { radius: 400, moveSpeed: 0.25, damage: 0.25 };
const DAMAGE = 20;

function auraRun() {
  const run = enemyRun((d) => {
    d.enemies.find((e) => e.id === "captain")!.aura = { ...AURA };
    const guard = d.enemies.find((e) => e.id === "shieldbearer")!;
    guard.attack.damageMin = DAMAGE;
    guard.attack.damageMax = DAMAGE;
  });
  run.hero.x = 4000;
  run.hero.y = 4000;
  return run;
}

/** Distance enemy i moves in one step. */
function stride(run: EnemyRun, i: number): number {
  const e = run.enemies;
  const x = e.x[i]!;
  const y = e.y[i]!;
  run.step(NO_INPUT);
  return Math.sqrt((e.x[i]! - x) * (e.x[i]! - x) + (e.y[i]! - y) * (e.y[i]! - y));
}

function stunnedCaptain(run: EnemyRun, x: number, y: number): number {
  const c = place(run, "captain", Role.Sieger, x, y);
  run.enemies.stunTicks[c] = 1e6;
  return c;
}

describe("captain aura", () => {
  it("enemies near a captain walk and hit harder", () => {
    const run = auraRun();
    const speed = run.data.enemies[typeOf(run, "shieldbearer")]!.moveSpeed;
    stunnedCaptain(run, 0, 0);
    const g = place(run, "shieldbearer", Role.Sieger, 200, 0);
    expect(stride(run, g)).toBeCloseTo((speed * (1 + AURA.moveSpeed)) / 30, 9);
    expect(run.enemies.buffed[g]).toBe(1);

    const siege = auraRun();
    const { castle } = siege;
    stunnedCaptain(siege, castle.x + 400, castle.y);
    place(siege, "shieldbearer", Role.Sieger, castle.x + castle.radius + 40, castle.y);
    siege.step(NO_INPUT);
    const hits = eventsOf(siege, EventKind.CastleHit);
    expect(hits).toHaveLength(1);
    expect(siege.events.value[hits[0]!]).toBeCloseTo(DAMAGE * (1 + AURA.damage), 9);
  });

  it("the aura ends with the captain", () => {
    const run = auraRun();
    const speed = run.data.enemies[typeOf(run, "shieldbearer")]!.moveSpeed;
    const c = stunnedCaptain(run, 0, 0);
    const g = place(run, "shieldbearer", Role.Sieger, 200, 0);
    expect(stride(run, g)).toBeGreaterThan(speed / 30 + 1);
    run.enemies.kill(c);
    expect(stride(run, g)).toBeCloseTo(speed / 30, 9);
    expect(run.enemies.buffed[g]).toBe(0);
  });

  it("two captains do not stack", () => {
    const run = auraRun();
    const speed = run.data.enemies[typeOf(run, "shieldbearer")]!.moveSpeed;
    stunnedCaptain(run, 0, 0);
    stunnedCaptain(run, 300, 100);
    const g = place(run, "shieldbearer", Role.Sieger, 200, 0);
    expect(stride(run, g)).toBeCloseTo((speed * (1 + AURA.moveSpeed)) / 30, 9);
  });

  it("a captain does not buff itself or another captain", () => {
    const run = auraRun();
    const speed = run.data.enemies[typeOf(run, "captain")]!.moveSpeed;
    const a = place(run, "captain", Role.Sieger, 0, 0);
    const b = place(run, "captain", Role.Sieger, 200, 0);
    expect(stride(run, a)).toBeCloseTo(speed / 30, 9);
    expect(run.enemies.buffed[a]).toBe(0);
    expect(run.enemies.buffed[b]).toBe(0);
  });

  it("out of range: no buff", () => {
    const run = auraRun();
    const speed = run.data.enemies[typeOf(run, "shieldbearer")]!.moveSpeed;
    stunnedCaptain(run, 0, 0);
    const g = place(run, "shieldbearer", Role.Sieger, AURA.radius + 30, 0);
    expect(stride(run, g)).toBeCloseTo(speed / 30, 9);
    expect(run.enemies.buffed[g]).toBe(0);
  });
});
