import { describe, expect, it } from "vitest";
import { Role } from "../enemies";
import { EventKind } from "../events";
import { heroStats } from "../hero";
import { NO_INPUT } from "../input";
import { createRun } from "../run";
import { gameData } from "../testing/game-data";

function newRun(intelligence = 24) {
  const data = gameData();
  data.rules.arena = {
    width: 6000, height: 5000, castle: { x: 0, y: -2400 }, heroStart: { x: 0, y: 0 },
    gates: [{ x: -1800, y: 2200 }, { x: 1800, y: 2200 }], gateRadius: 150,
  };
  data.rules.hero = {
    collision: 32, baseRegen: 0.25, regenPerStr: 0.05, spellPowerPerInt: 0.01, cooldownSpeedPerInt: 0.01,
    dash: { distance: 350, seconds: 0.15, cooldownSeconds: 4 },
  };
  data.rules.phases[0].spawnPerSecond = 0;
  data.constants.defenseArmor = 0.02;
  const ab = data.abilities.find((a) => a.id === "rock-rupture");
  if (!ab || ab.kind !== "line") throw new Error("test setup");
  ab.cooldown = [12, 12, 12, 12, 12];
  ab.params.damage = [500, 1000, 2000, 3500, 5000];
  ab.params.length = [1500, 1500, 1500, 1500, 1500];
  ab.params.width = [350, 400, 450, 500, 550];
  ab.params.stunSeconds = [2, 2, 2, 2, 2];
  ab.params.waveSpeed = [1000, 1000, 1000, 1000, 1000];
  data.enemies[0].collision = 31;
  const run = createRun(data, { seed: 3, durationSeconds: 100000 });
  run.hero.int = intelligence;
  heroStats(run.data, run.hero, run.hero.stats);
  run.hero.hp = run.hero.stats.maxHp;
  return run;
}

type TestRun = ReturnType<typeof newRun>;

function add(run: TestRun, dx: number, dy: number, hp = 100000): number {
  const i = run.enemies.spawn(0, Role.Hunter, 0, run.hero.x + dx, run.hero.y + dy, hp, 1, 0);
  run.enemies.stunTicks[i] = 100000;
  return i;
}

function ofKind(run: TestRun, kind: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === kind) out.push(k);
  return out;
}

describe("line ability", () => {
  it("casts when an enemy is within length", () => {
    const run = newRun();
    add(run, 0, 1000);
    run.step(NO_INPUT);
    const c = ofKind(run, EventKind.Cast);
    expect(c.length).toBe(1);
    const k = c[0];
    expect(run.events.a[k]).toBe(0);
    expect(run.events.value[k]).toBe(1500);
    expect(run.events.x[k]).toBe(0);
    expect(run.events.y[k]).toBe(0);
    expect(run.events.u[k]).toBeCloseTo(0, 9);
    expect(run.events.v[k]).toBeCloseTo(1, 9);
    expect(run.abilities[0].cooldown).toBe(290);
  });

  it("waits when no enemy is in range", () => {
    const run = newRun();
    add(run, 0, 1600);
    run.step(NO_INPUT);
    expect(ofKind(run, EventKind.Cast).length).toBe(0);
    expect(run.abilities[0].cooldown).toBe(0);
    expect(run.abilities[0].active).toBe(false);
  });

  it("fires along the move direction while moving", () => {
    const run = newRun();
    const e = add(run, 500, 0);
    run.step({ ...NO_INPUT, moveY: 1 });
    const c = ofKind(run, EventKind.Cast);
    expect(c.length).toBe(1);
    expect(run.events.u[c[0]]).toBe(0);
    expect(run.events.v[c[0]]).toBe(1);
    expect(run.enemies.hp[e]).toBe(100000);
  });

  it("targets the nearest enemy when standing", () => {
    const run = newRun();
    add(run, 0, 900);
    add(run, 400, 0);
    run.step(NO_INPUT);
    const c = ofKind(run, EventKind.Cast);
    expect(run.events.u[c[0]]).toBeCloseTo(1, 9);
    expect(run.events.v[c[0]]).toBeCloseTo(0, 9);
  });

  it("hits each enemy on the line once and stuns it", () => {
    const run = newRun();
    const ids = [300, 600, 900].map((d) => add(run, 0, d, 5000));
    const hitCount = new Map<number, number>();
    for (let n = 0; n < 40; n++) {
      run.step(NO_INPUT);
      for (const k of ofKind(run, EventKind.Hit)) {
        const s = run.events.a[k];
        hitCount.set(s, (hitCount.get(s) ?? 0) + 1);
      }
    }
    for (const id of ids) {
      expect(hitCount.get(id)).toBe(1);
      expect(run.enemies.stunTicks[id]).toBeGreaterThan(0);
    }
  });

  it("stuns for the configured time", () => {
    const run = newRun();
    const e = run.enemies.spawn(0, Role.Hunter, 0, 0, 300, 5000, 1, 0);
    run.step(NO_INPUT);
    // the wave needs a few steps to reach 300; run until the hit
    for (let n = 0; n < 30 && run.enemies.hp[e] === 5000; n++) run.step(NO_INPUT);
    expect(run.enemies.hp[e]).toBeLessThan(5000);
    expect(run.enemies.stunTicks[e]).toBeGreaterThanOrEqual(59);
    expect(run.enemies.stunTicks[e]).toBeLessThanOrEqual(60);
  });

  it("damage scales with spell power", () => {
    const run = newRun();
    add(run, 0, 300, 5000);
    let dmg = 0;
    for (let n = 0; n < 10 && dmg === 0; n++) {
      run.step(NO_INPUT);
      for (const k of ofKind(run, EventKind.Hit)) {
        dmg = run.events.value[k];
        expect(run.events.u[k]).toBe(1);
      }
    }
    expect(dmg).toBeCloseTo(620, 9);
  });

  it("front travels at waveSpeed", () => {
    const run = newRun();
    add(run, 0, 990, 5000);
    let castTick = -1;
    let hitTick = -1;
    for (let n = 0; n < 60 && hitTick < 0; n++) {
      run.step(NO_INPUT);
      if (castTick < 0 && ofKind(run, EventKind.Cast).length > 0) castTick = run.tick;
      if (ofKind(run, EventKind.Hit).length > 0) hitTick = run.tick;
    }
    expect(castTick).toBeGreaterThan(0);
    // front reaches 990 - 31 = 959 after about 29 steps
    expect(Math.abs(hitTick - castTick - 29)).toBeLessThanOrEqual(1);
  });

  it("ignores enemies outside the width", () => {
    const run = newRun();
    add(run, 0, 600);
    const far = add(run, 300, 600); // lateral 300 > 175 + 31
    const hp = run.enemies.hp[far];
    for (let n = 0; n < 40; n++) run.step(NO_INPUT);
    expect(run.enemies.hp[far]).toBe(hp);
  });

  it("hits carry the slot as ref", () => {
    const run = newRun();
    add(run, 0, 600);
    let hits: number[] = [];
    for (let n = 0; n < 40 && hits.length === 0; n++) {
      run.step(NO_INPUT);
      hits = ofKind(run, EventKind.Hit);
    }
    expect(hits.length).toBeGreaterThan(0);
    expect(run.events.u[hits[0]]).toBe(1);
    expect(run.events.v[hits[0]]).toBe(0);
  });

  it("an unsupported ability kind throws when stepped", () => {
    const data = gameData();
    const hero = data.heroes.find((h) => h.id === data.rules.start.hero)!;
    hero.signatureAbilities[0] = "serpent-totem";
    const run = createRun(data, { seed: 1 });
    expect(() => run.step(NO_INPUT)).toThrow("sim: ability kind summon is not implemented");
  });
});
