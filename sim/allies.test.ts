import { describe, expect, it } from "vitest";
import { ALLY_CAPACITY, AllyKind } from "./allies";
import { armorReduction } from "./combat";
import { TICKS_PER_SECOND } from "./constants";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { createRun } from "./run";
import { IMAGE_OFFSETS, WARD_RING } from "./abilities/summon";
import { abilityRun, addEnemy, eventsOf, quietData } from "./testing/ability-run";
import { gameData } from "./testing/game-data";

function dist(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

const WARD = 0; // Serpent Shaman slot 0: serpent-totem
const ULT = 3; // Night Glaive ultimate: shadow-sisters

function wardDef(data = quietData()) {
  const ab = data.abilities.find((a) => a.id === "serpent-totem");
  if (!ab || ab.kind !== "summon") throw new Error("test setup");
  return ab;
}

function imageDef(data = quietData()) {
  const ab = data.abilities.find((a) => a.id === "shadow-sisters");
  if (!ab || ab.kind !== "summon") throw new Error("test setup");
  return ab;
}

function wardRun(level: number, data = quietData()) {
  return abilityRun("serpent-shaman", { [WARD]: level }, data);
}

function wardsOf(run: { allies: { capacity: number; alive: Uint8Array } }): number[] {
  const out: number[] = [];
  for (let i = 0; i < run.allies.capacity; i++) if (run.allies.alive[i] !== 0) out.push(i);
  return out;
}

function imageRun(data = quietData()) {
  return abilityRun("nightglaive", { [ULT]: 1 }, data);
}

function castImages(run: ReturnType<typeof imageRun>): void {
  run.ultimateRequested = true;
  run.step(NO_INPUT);
}

describe("serpent wards", () => {
  it("wards appear at the densest cluster in range", () => {
    const run = wardRun(2);
    addEnemy(run, 300, 100);
    addEnemy(run, 330, 100);
    addEnemy(run, 300, 130);
    addEnemy(run, -400, 0);
    run.step(NO_INPUT);
    const c = eventsOf(run, EventKind.Cast);
    expect(c.length).toBe(1);
    const count = wardDef().params.count[1];
    expect(run.events.value[c[0]]).toBe(count);
    const cx = run.events.x[c[0]];
    const cy = run.events.y[c[0]];
    expect(Math.abs(cx - (run.hero.x + 300))).toBeLessThan(60);
    const ids = wardsOf(run);
    expect(ids.length).toBe(count);
    for (const i of ids) {
      expect(run.allies.kind[i]).toBe(AllyKind.Ward);
      expect(dist(run.allies.x[i] - cx, run.allies.y[i] - cy)).toBeLessThanOrEqual(WARD_RING + 1);
    }
  });

  it("waits without a cluster in range", () => {
    const run = wardRun(1);
    addEnemy(run, 0, 700);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(0);
    expect(run.allies.count).toBe(0);
  });

  it("wards bite the nearest enemy every attackInterval", () => {
    const data = quietData();
    const p = wardDef(data).params;
    const run = wardRun(1, data);
    const near = addEnemy(run, 300, 0);
    run.step(NO_INPUT);
    const first = eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 2);
    expect(first.length).toBe(1);
    const k = first[0];
    const ward = wardsOf(run)[0];
    expect(run.events.a[k]).toBe(near);
    expect(run.events.v[k]).toBe(ward);
    const reduction = armorReduction(run.data.enemies[0].armor, run.data.constants.defenseArmor);
    expect(run.events.value[k]).toBeCloseTo(p.damage![0] * run.hero.stats.spellPower * (1 - reduction), 9);
    const interval = Math.round(p.attackInterval![0] * TICKS_PER_SECOND);
    for (let s = 1; s < interval; s++) {
      run.step(NO_INPUT);
      expect(eventsOf(run, EventKind.Hit).filter((i) => run.events.u[i] === 2).length).toBe(0);
    }
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Hit).filter((i) => run.events.u[i] === 2).length).toBe(1);
    expect(run.allies.lastAttackTick[ward]).toBe(run.tick - 1);
  });

  it("wards expire after duration", () => {
    const data = quietData();
    const run = wardRun(1, data);
    addEnemy(run, 300, 0);
    run.step(NO_INPUT);
    const ward = wardsOf(run)[0];
    const expires = run.allies.expiresTick[ward];
    expect(expires - run.allies.spawnTick[ward]).toBe(Math.round(wardDef(data).params.duration[0] * TICKS_PER_SECOND));
    while (run.tick < expires) {
      expect(run.allies.alive[ward]).toBe(1);
      run.abilities[WARD].cooldown = 1e6;
      run.step(NO_INPUT);
    }
    expect(run.allies.alive[ward]).toBe(1);
    run.step(NO_INPUT); // disappears in the step where tick >= expiresTick
    expect(run.allies.alive[ward]).toBe(0);
    expect(run.allies.count).toBe(0);
  });

  it("ward cap removes the oldest", () => {
    const data = quietData();
    const p = wardDef(data).params;
    const run = wardRun(1, data);
    addEnemy(run, 300, 0);
    const castTicks: number[] = [];
    for (let n = 0; n < p.maxAlive![0] + 1; n++) {
      run.abilities[WARD].cooldown = 0;
      castTicks.push(run.tick);
      run.step(NO_INPUT);
    }
    const alive = wardsOf(run);
    expect(alive.length).toBe(p.maxAlive![0]);
    const ticks = alive.map((i) => run.allies.spawnTick[i]).sort((x, y) => x - y);
    expect(ticks).toEqual(castTicks.slice(1));
  });

  it("full ally store stops spawning", () => {
    const data = quietData();
    wardDef(data).params.maxAlive = [100, 100, 100, 100, 100];
    const run = wardRun(2, data);
    for (let i = 0; i < ALLY_CAPACITY - 1; i++) {
      run.allies.spawn(AllyKind.Ward, WARD, 0, 2000, 2000, 0, 1e9);
    }
    addEnemy(run, 300, 0);
    run.step(NO_INPUT);
    expect(eventsOf(run, EventKind.Cast).length).toBe(1);
    expect(run.allies.count).toBe(ALLY_CAPACITY);
  });
});

describe("shadow copies", () => {
  it("images spawn around the hero and follow it", () => {
    const data = quietData();
    const run = imageRun(data);
    const count = imageDef(data).params.count[0];
    castImages(run);
    const c = eventsOf(run, EventKind.Cast);
    expect(c.length).toBe(1);
    expect(run.events.value[c[0]]).toBe(count);
    expect(run.events.x[c[0]]).toBe(run.hero.x);
    expect(run.events.y[c[0]]).toBe(run.hero.y);
    const ids = wardsOf(run);
    expect(ids.length).toBe(count);
    for (const i of ids) expect(run.allies.kind[i]).toBe(AllyKind.Image);
    for (let s = 0; s < 60; s++) run.step({ moveX: 1, moveY: 0, card: -1, actions: 0 });
    expect(run.hero.x).toBeGreaterThan(100);
    for (const i of ids) {
      const [ox, oy] = IMAGE_OFFSETS[run.allies.formation[i]];
      expect(dist(run.allies.x[i] - (run.hero.x + ox), run.allies.y[i] - (run.hero.y + oy))).toBeLessThan(30);
    }
  });

  it("images attack with damageDealt of the hero damage", () => {
    const data = quietData();
    const p = imageDef(data).params;
    const run = imageRun(data);
    addEnemy(run, 0, -100);
    castImages(run); // the copies bite in the step they appear
    const hits = eventsOf(run, EventKind.Hit).filter((k) => run.events.u[k] === 2);
    expect(hits.length).toBeGreaterThan(0);
    const k = hits[0];
    const stats = run.hero.stats;
    const reduction = armorReduction(run.data.enemies[0].armor, run.data.constants.defenseArmor);
    const lo = Math.round(stats.damageMin) * p.damageDealt![0] * (1 - reduction);
    const hi = Math.round(stats.damageMax) * p.damageDealt![0] * (1 - reduction);
    expect(run.events.value[k]).toBeGreaterThanOrEqual(lo - 1e-9);
    expect(run.events.value[k]).toBeLessThanOrEqual(hi + 1e-9);
    expect(run.allies.kind[run.events.v[k]]).toBe(AllyKind.Image);
  });

  it("recast replaces the images", () => {
    const data = quietData();
    const run = imageRun(data);
    castImages(run);
    const first = wardsOf(run).map((i) => run.allies.spawnTick[i]);
    for (let s = 0; s < 5; s++) run.step(NO_INPUT);
    run.abilities[ULT].cooldown = 0;
    castImages(run);
    const ids = wardsOf(run);
    expect(ids.length).toBe(imageDef(data).params.count[0]);
    for (const i of ids) expect(run.allies.spawnTick[i]).toBeGreaterThan(Math.max(...first));
  });
});

describe("allies determinism", () => {
  it("same seed gives the same allies", () => {
    function play(): { hash: number; peak: number } {
      const run = createRun(gameData(), { seed: 11, hero: "serpent-shaman", durationSeconds: 100000 });
      let peak = 0;
      for (let s = 0; s < 900; s++) {
        run.step({ moveX: s % 120 < 60 ? 1 : -1, moveY: 0, card: -1, actions: 0 });
        peak = Math.max(peak, run.allies.count);
      }
      return { hash: stateHash(run), peak };
    }
    const a = play();
    expect(a.peak).toBeGreaterThan(0);
    expect(play()).toEqual(a);
  });
});
