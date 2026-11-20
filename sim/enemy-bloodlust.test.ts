import { describe, expect, it } from "vitest";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { enemyRun, eventsOf, place, typeOf, type EnemyRun } from "./testing/enemy-run";

const DAMAGE = 20;

function bloodRun() {
  const run = enemyRun((d) => {
    d.enemies.find((e) => e.id === "bloodcaller")!.moveSpeed = 0;
    const brute = d.enemies.find((e) => e.id === "brute")!;
    brute.attack.damageMin = DAMAGE;
    brute.attack.damageMax = DAMAGE;
  });
  run.hero.x = 4000;
  run.hero.y = 4000;
  return run;
}

/** A brute that stays where it is (stunned), so the distances of a test hold. */
function frozen(run: EnemyRun, id: string, x: number, y: number): number {
  const slot = place(run, id, Role.Sieger, x, y);
  run.enemies.stunTicks[slot] = 1e6;
  return slot;
}

function stride(run: EnemyRun, i: number): number {
  const e = run.enemies;
  const x = e.x[i]!;
  const y = e.y[i]!;
  run.step(NO_INPUT);
  return Math.sqrt((e.x[i]! - x) * (e.x[i]! - x) + (e.y[i]! - y) * (e.y[i]! - y));
}

describe("bloodlust", () => {
  it("a bloodcaller lusts the 3 nearest orcs for 8 s and, 6 s later, the ones without it", () => {
    const run = bloodRun();
    const shaman = place(run, "bloodcaller", Role.Sieger, 0, 0);
    const near = [frozen(run, "brute", 100, 0), frozen(run, "brute", 0, 200), frozen(run, "hornback", -300, 0)];
    const far = frozen(run, "brute", 0, -400);
    const human = frozen(run, "shieldbearer", 50, 50);
    const boss = frozen(run, "iron-marshal", -60, -60);
    run.step(NO_INPUT);
    const e = run.enemies;
    for (const slot of near) expect(e.bloodlustTicks[slot], `slot ${slot}`).toBe(240);
    expect(e.bloodlustTicks[far]).toBe(0);
    expect(e.bloodlustTicks[human]).toBe(0);
    expect(e.bloodlustTicks[boss]).toBe(0);
    expect(e.bloodlustTicks[shaman]).toBe(0);
    const cast = eventsOf(run, EventKind.Bloodlust);
    expect(cast).toHaveLength(1);
    expect(run.events.a[cast[0]!]).toBe(shaman);
    expect(run.events.value[cast[0]!]).toBe(3);

    for (let i = 0; i < 6 * 30 - 1; i++) run.step(NO_INPUT);
    expect(e.bloodlustTicks[far]).toBe(0);
    run.step(NO_INPUT);
    expect(e.bloodlustTicks[far]).toBe(240);
    for (const slot of near) expect(e.bloodlustTicks[slot]).toBe(240 - 180);
    for (let i = 0; i < 6 * 30; i++) run.step(NO_INPUT);
    for (const slot of near) expect(e.bloodlustTicks[slot]).toBe(240);
    expect(e.bloodlustTicks[human]).toBe(0);
  });

  it("without a target the cooldown does not start", () => {
    const run = bloodRun();
    const shaman = place(run, "bloodcaller", Role.Sieger, 0, 0);
    frozen(run, "shieldbearer", 100, 0);
    run.step(NO_INPUT);
    expect(run.enemies.bloodlustCooldown[shaman]).toBe(0);
    expect(eventsOf(run, EventKind.Bloodlust)).toHaveLength(0);
    const late = frozen(run, "brute", 0, 100);
    run.step(NO_INPUT);
    expect(run.enemies.bloodlustTicks[late]).toBe(240);
  });

  it("a lusted brute walks 30 % faster, hits 30 % harder and attacks after delay / 1.3", () => {
    const run = bloodRun();
    const lust = typeOf(run, "bloodcaller");
    const def = run.data.enemies[typeOf(run, "brute")]!;
    const g = place(run, "brute", Role.Sieger, 2000, 2000);
    const plain = stride(run, g);
    expect(plain).toBeCloseTo(def.moveSpeed / 30, 9);
    run.enemies.bloodlustTicks[g] = 100;
    run.enemies.bloodlustType[g] = lust;
    expect(stride(run, g)).toBeCloseTo((def.moveSpeed * 1.3) / 30, 9);

    const { castle } = run;
    const a = place(run, "brute", Role.Sieger, castle.x + castle.radius + def.collision + 20, castle.y);
    run.enemies.bloodlustTicks[a] = 100;
    run.enemies.bloodlustType[a] = lust;
    run.step(NO_INPUT);
    const hits = eventsOf(run, EventKind.CastleHit).filter((k) => run.events.a[k] === a);
    expect(hits).toHaveLength(1);
    expect(run.events.value[hits[0]!]).toBeCloseTo(DAMAGE * 1.3, 9);
    expect(run.enemies.attackCooldown[a]).toBe(Math.round((def.attack.cooldown * 30) / 1.3));
  });

  it("the same seed gives the same state", () => {
    const play = () => {
      const run = bloodRun();
      place(run, "bloodcaller", Role.Sieger, 0, 0);
      for (let k = 0; k < 5; k++) place(run, "brute", Role.Hunter, 100 * k, 300);
      for (let i = 0; i < 400; i++) run.step(NO_INPUT);
      return stateHash(run);
    };
    expect(play()).toBe(play());
  });
});
