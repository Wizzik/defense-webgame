import { describe, expect, it } from "vitest";
import type { GameData, Meteors } from "../data/schema";
import { botInput } from "./bot";
import { HeroHitSource } from "./combat";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { addPool, poolAt, POOL_CAPACITY } from "./fire-pools";
import { debugHazard } from "./hazard";
import { stateHash as hashRun } from "./hash";
import { NO_INPUT, type TickInput } from "./input";
import { createRun, type Run } from "./run";
import { spawnAt } from "./spawner";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";
import { isFree } from "./world-map/geometry";

function quiet(tweak?: (m: Meteors) => void): GameData {
  const data = gameData();
  silenceSpawns(data);
  const h = data.worlds[4]!.hazard;
  if (h.kind !== "meteors") throw new Error("world 5 has no meteors");
  tweak?.(h);
  return data;
}

function run5(data = quiet(), players?: { hero: string }[]): Run {
  return createRun(data, { seed: 1, world: 5, durationSeconds: 100000, players });
}

/** Steps; returns the fire damage per player. */
function burn(run: Run, n: number, input: TickInput | TickInput[] = NO_INPUT): number[] {
  const taken = run.players.map(() => 0);
  for (let s = 0; s < n; s++) {
    run.castle.hp = run.castle.maxHp;
    run.step(input as TickInput);
    for (let i = 0; i < run.events.count; i++) {
      if (run.events.kind[i] === EventKind.HeroHit && run.events.u[i] === HeroHitSource.Fire) {
        taken[run.events.v[i]!]! += run.events.value[i]!;
      }
    }
  }
  return taken;
}

function livePools(run: Run): number {
  let n = 0;
  for (let i = 0; i < run.hazard.poolTicks.length; i++) if (run.hazard.poolTicks[i]! > 0) n++;
  return n;
}

describe("fire pools", () => {
  it("a meteor strike leaves a pool for pool.seconds", () => {
    const run = run5();
    debugHazard(run);
    let struck = -1;
    for (let s = 1; s <= 45 && struck < 0; s++) {
      run.step(NO_INPUT);
      for (let i = 0; i < run.events.count; i++) {
        if (run.events.kind[i] === EventKind.Hazard && run.events.value[i] === 2) struck = s;
      }
    }
    expect(struck).toBe(45);
    expect(Math.max(...run.hazard.poolTicks)).toBe(6 * 30);
    expect(run.hazard.pools).toBe(livePools(run));
    run.hero.hp = 1e9;
    for (let s = 0; s < 179; s++) run.step(NO_INPUT);
    expect(livePools(run)).toBeGreaterThan(0);
    run.step(NO_INPUT);
    expect(livePools(run)).toBe(0);
  });

  it("a pool burns the hero heroSharePerSecond of max hp a second", () => {
    const run = run5();
    addPool(run, run.hero.x, run.hero.y);
    const [taken] = burn(run, 30);
    expect(taken).toBeCloseTo((run.data.worlds[4]!.hazard as Meteors).pool.heroSharePerSecond * run.hero.stats.maxHp, 6);
    const shielded = run5();
    shielded.players[0]!.shieldTicks = 1000;
    addPool(shielded, shielded.hero.x, shielded.hero.y);
    expect(burn(shielded, 30)[0]).toBe(0);
  });

  it("a pool burns enemies and bosses by their shares", () => {
    const run = run5(quiet((m) => { m.pool.radius = 6000; }));
    const boss = run.data.enemies.findIndex((e) => e.boss);
    const common = spawnAt(run, 0, Role.Sieger, -1500, -2000);
    const big = spawnAt(run, boss, Role.Sieger, 1500, -2000);
    run.enemies.stunTicks[common] = 1000;
    run.enemies.stunTicks[big] = 1000;
    addPool(run, 0, -2000);
    const hp = [run.enemies.hp[common]!, run.enemies.hp[big]!];
    run.hero.hp = 1e9;
    for (let s = 0; s < 30; s++) run.step(NO_INPUT);
    const { pool } = run.data.worlds[4]!.hazard as Meteors;
    expect(hp[0]! - run.enemies.hp[common]!).toBeCloseTo(pool.enemySharePerSecond * run.enemies.maxHp[common]!, 6);
    expect(hp[1]! - run.enemies.hp[big]!).toBeCloseTo(pool.bossSharePerSecond * run.enemies.maxHp[big]!, 6);
  });

  it("one pool per pulse", () => {
    const run = run5();
    addPool(run, run.hero.x, run.hero.y);
    addPool(run, run.hero.x + 20, run.hero.y);
    const [taken] = burn(run, 30);
    expect(taken).toBeCloseTo(0.04 * run.hero.stats.maxHp, 6);
  });

  it("a choosing or fallen hero is not burned", () => {
    const run = run5(quiet(), [{ hero: "stonehorn" }, { hero: "sparkshot" }, { hero: "tidecaller" }]);
    run.players[1]!.hero.pendingLevelUps = 1;
    run.step([NO_INPUT, NO_INPUT, NO_INPUT]);
    run.players[0]!.hero.hp = 0;
    for (const p of run.players) addPool(run, p.hero.x, p.hero.y);
    const taken = burn(run, 30, [NO_INPUT, NO_INPUT, NO_INPUT]);
    expect(taken[0]).toBe(0);
    expect(taken[1]).toBe(0);
    expect(taken[2]).toBeGreaterThan(0);
  });

  it("a new run has no pools, and pools do not block walking", () => {
    const run = run5();
    addPool(run, run.hero.x, run.hero.y);
    expect(livePools(run)).toBe(1);
    expect(isFree(run.map, run.hero.x, run.hero.y, run.hero.stats.collision)).toBe(true);
    const next = run5();
    expect(livePools(next)).toBe(0);
    expect(next.hazard.pools).toBe(0);
  });

  it("a full pool list overwrites the oldest pool", () => {
    const run = run5();
    for (let i = 0; i < POOL_CAPACITY + 1; i++) {
      addPool(run, i * 10, 0);
      run.step(NO_INPUT);
    }
    expect(livePools(run)).toBe(POOL_CAPACITY);
    expect(poolAt(run, POOL_CAPACITY * 10, 0, 1)).toBeGreaterThanOrEqual(0);
  });

  it("meteors fall from phase 1 around every living hero", () => {
    const run = run5(quiet(), [{ hero: "stonehorn" }, { hero: "sparkshot" }]);
    let first = -1;
    let warnings = 0;
    for (let s = 0; s < 25 * 30 && first < 0; s++) {
      for (const p of run.players) p.hero.hp = p.hero.stats.maxHp;
      run.step([NO_INPUT, NO_INPUT]);
      for (let i = 0; i < run.events.count; i++) {
        if (run.events.kind[i] === EventKind.Hazard && run.events.value[i] === 0) warnings++;
      }
      if (warnings > 0) first = run.tick;
    }
    expect(first).toBeGreaterThanOrEqual(18 * 30);
    expect(first).toBeLessThanOrEqual(24 * 30 + 1);
    expect(warnings).toBeGreaterThanOrEqual(6);
    expect(warnings).toBeLessThanOrEqual(12);
  });

  it("the bot walks out of a pool within 1 s", () => {
    const run = run5();
    run.hero.x = 400;
    run.hero.y = -800;
    addPool(run, run.hero.x, run.hero.y);
    const input: TickInput = { ...NO_INPUT };
    for (let s = 0; s < 30; s++) {
      botInput(run, input);
      run.step(input);
    }
    expect(poolAt(run, run.hero.x, run.hero.y, run.hero.stats.collision)).toBe(-1);
  });

  it("the hash covers pools only in a meteors world", () => {
    const run = run5();
    const a = hashRun(run);
    addPool(run, 100, 100);
    expect(hashRun(run)).not.toBe(a);
    const w1 = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    const b = hashRun(w1);
    w1.hazard.poolTicks[0] = 50;
    expect(hashRun(w1)).toBe(b);
  });
});
