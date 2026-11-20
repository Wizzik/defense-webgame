import { describe, expect, it } from "vitest";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { rootHero, slowHero } from "./hero-snares";
import { InputAction, NO_INPUT, type TickInput } from "./input";
import { OrbKind, startBuff } from "./buffs";
import { scatterMember } from "./spawner";
import { enemyRun, eventsOf, place, typeOf, type EnemyRun } from "./testing/enemy-run";

const EAST: TickInput = { moveX: 1, moveY: 0, card: -1, actions: 0 };

/** How far the hero walks east in one step. */
function walk(run: EnemyRun, input: TickInput = EAST): number {
  const x = run.hero.x;
  run.step(input);
  return run.hero.x - x;
}

function snareRun() {
  const run = enemyRun();
  run.hero.x = 0;
  run.hero.y = 0;
  return run;
}

describe("web slow", () => {
  it("a webcrawler hit slows the hero to 70 % for 60 steps; a second hit renews, it does not stack", () => {
    const run = snareRun();
    place(run, "webcrawler", Role.Hunter, 300, 0);
    let hit = false;
    for (let i = 0; i < 200 && !hit; i++) {
      run.step(NO_INPUT);
      hit = eventsOf(run, EventKind.HeroHit).length > 0;
    }
    expect(hit).toBe(true);
    expect(run.hero.slowTicks).toBe(60);
    expect(run.hero.slowShare).toBeCloseTo(0.3, 9);
    expect(eventsOf(run, EventKind.HeroSnared).map((k) => run.events.value[k])).toEqual([0]);

    const free = snareRun();
    const speed = walk(free);
    const slowed = snareRun();
    slowHero(slowed, 0.3, 60);
    slowHero(slowed, 0.3, 40);
    expect(slowed.hero.slowTicks).toBe(60);
    for (let i = 0; i < 60; i++) expect(walk(slowed)).toBeCloseTo(speed * 0.7, 9);
    expect(walk(slowed)).toBeCloseTo(speed, 9);
  });

  it("web and boots apply together, and the speed comes back exactly", () => {
    const run = snareRun();
    const plain = walk(run);
    startBuff(run, OrbKind.Boots);
    const boots = walk(run);
    expect(boots).toBeCloseTo(plain * run.data.rules.sustain.boots.moveSpeed, 9);
    slowHero(run, 0.3, 30);
    for (let i = 0; i < 30; i++) expect(walk(run)).toBeCloseTo(boots * 0.7, 9);
    expect(walk(run)).toBeCloseTo(boots, 9);
  });
});

describe("roots", () => {
  /** A druid 600 east of the hero; the steps until its circle lands (the windup is 1 s). */
  function rooted(run: EnemyRun): number {
    const druid = place(run, "grove-druid", Role.Hunter, run.hero.x + 600, run.hero.y);
    run.enemies.healCooldown[druid] = 1e6;
    run.step(NO_INPUT);
    const warn = eventsOf(run, EventKind.Slam);
    expect(warn).toHaveLength(1);
    expect(run.events.u[warn[0]!]).toBe(160);
    return druid;
  }

  it("the hero in the circle is rooted for 36 steps: no walking, no dash", () => {
    const run = snareRun();
    rooted(run);
    for (let i = 0; i < 29; i++) run.step(NO_INPUT);
    expect(run.hero.rootTicks).toBe(0);
    const hp = run.hero.hp;
    const castle = run.castle.hp;
    run.step(NO_INPUT);
    expect(run.hero.rootTicks).toBe(36);
    // the circle hurts nobody
    expect(run.hero.hp).toBe(hp);
    expect(run.castle.hp).toBe(castle);
    expect(eventsOf(run, EventKind.HeroSnared).map((k) => run.events.value[k])).toEqual([1]);
    for (let i = 0; i < 36; i++) {
      expect(walk(run, { ...EAST, actions: i === 0 ? InputAction.Dash : 0 })).toBe(0);
      expect(run.hero.dashTicks).toBe(0);
    }
    expect(walk(run)).toBeGreaterThan(0);
  });

  it("a circle that reaches the castle does not hurt it", () => {
    const run = snareRun();
    run.hero.x = run.castle.x + run.castle.radius + 60;
    run.hero.y = run.castle.y;
    rooted(run);
    const castle = run.castle.hp;
    for (let i = 0; i < 30; i++) run.step(NO_INPUT);
    expect(run.hero.rootTicks).toBe(36);
    expect(run.castle.hp).toBe(castle);
  });

  it("roots end a dash that is running", () => {
    const run = snareRun();
    run.step({ ...EAST, actions: InputAction.Dash });
    expect(run.hero.dashTicks).toBeGreaterThan(0);
    rootHero(run, 36);
    rootHero(run, 10);
    expect(run.hero.rootTicks).toBe(36);
    expect(walk(run)).toBe(0);
    expect(run.hero.dashTicks).toBe(0);
  });

  it("a hero who leaves the circle is not rooted", () => {
    const run = snareRun();
    rooted(run);
    run.hero.x = -400;
    for (let i = 0; i < 30; i++) run.step(NO_INPUT);
    expect(run.hero.rootTicks).toBe(0);
  });

  it("a fresh druid waits its full cooldown before the first roots", () => {
    const run = snareRun();
    const slot = scatterMember(run, typeOf(run, "grove-druid"), Role.Hunter, 600, 0, 0, 1);
    expect(run.enemies.strikeCooldown[slot]).toBe(9 * 30);
    const warden = scatterMember(run, typeOf(run, "grove-warden"), Role.Hunter, 600, 300, 0, 1);
    expect(run.enemies.strikeCooldown[warden]).toBe(6 * 30);
  });
});
