import { describe, expect, it } from "vitest";
import type { GameData } from "../data/schema";
import { HeroHitSource } from "./combat";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { debugHazard, hazardPending, HAZARD_CAPACITY } from "./hazard";
import { NO_INPUT } from "./input";
import { createRun, type Run } from "./run";
import { spawnAt } from "./spawner";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

function quiet(tweak?: (d: GameData) => void): GameData {
  const data = gameData();
  silenceSpawns(data);
  tweak?.(data);
  return data;
}

function count(run: Run, kind: number, value?: number): number {
  let n = 0;
  for (let i = 0; i < run.events.count; i++) {
    if (run.events.kind[i] === kind && (value === undefined || run.events.value[i] === value)) n++;
  }
  return n;
}

/** Steps a quiet run with the hero standing; returns the ticks of the waves and the bolt centres' distance from the hero. */
function waves(run: Run, seconds: number): { tick: number; bolts: number; far: number }[] {
  const out: { tick: number; bolts: number; far: number }[] = [];
  const pick = { ...NO_INPUT, card: 0 };
  for (let s = 0; s < seconds * 30; s++) {
    run.hero.hp = run.hero.stats.maxHp;
    run.step(pick);
    const warnings = count(run, EventKind.Hazard, 0);
    if (warnings === 0) continue;
    let far = 0;
    for (let i = 0; i < run.events.count; i++) {
      if (run.events.kind[i] !== EventKind.Hazard || run.events.value[i] !== 0) continue;
      const dx = run.events.x[i]! - run.hero.x;
      const dy = run.events.y[i]! - run.hero.y;
      far = Math.max(far, Math.sqrt(dx * dx + dy * dy));
    }
    out.push({ tick: run.tick - 1, bolts: warnings, far });
  }
  return out;
}

describe("summer storm", () => {
  it("comes in waves of 1-3 bolts everySeconds apart from phase 3, the first everySeconds into it", () => {
    const run = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    const { min, max } = run.data.worlds[0]!.hazard.everySeconds;
    const list = waves(run, 100 + 6 * max);
    expect(list.length).toBeGreaterThan(4);
    expect(list[0]!.tick).toBeGreaterThanOrEqual((100 + min) * 30);
    expect(list[0]!.tick).toBeLessThanOrEqual((100 + max) * 30);
    for (let k = 1; k < list.length; k++) {
      const gap = list[k]!.tick - list[k - 1]!.tick;
      expect(gap).toBeGreaterThanOrEqual(min * 30);
      expect(gap).toBeLessThanOrEqual(max * 30);
    }
    for (const w of list) {
      expect(w.bolts).toBeGreaterThanOrEqual(1);
      expect(w.bolts).toBeLessThanOrEqual(3);
      expect(w.far).toBeLessThanOrEqual(300 + 1e-9);
    }
  });

  it("warns 36 steps ahead and takes exactly 8 % of max hp from a hero who stands in it", () => {
    const run = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    debugHazard(run);
    for (let i = 0; i < HAZARD_CAPACITY; i++) {
      run.hazard.x[i] = run.hero.x;
      run.hazard.y[i] = run.hero.y;
    }
    expect(hazardPending(run)).toBe(36);
    let hits = 0;
    let taken = 0;
    for (let s = 1; s <= 36; s++) {
      run.step(NO_INPUT);
      for (let i = 0; i < run.events.count; i++) {
        if (run.events.kind[i] === EventKind.HeroHit && run.events.u[i] === HeroHitSource.Storm) {
          hits++;
          taken += run.events.value[i]!;
          expect(s).toBe(36);
        }
      }
    }
    expect(hits).toBe(run.hazard.bolts);
    expect(taken).toBeCloseTo(hits * 0.08 * run.hero.stats.maxHp, 6);
    expect(hazardPending(run)).toBe(0);
  });

  it("misses a hero who walked out of the circle", () => {
    const run = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    debugHazard(run);
    let hits = 0;
    for (let s = 0; s < 36; s++) {
      run.hero.x = 2500;
      run.hero.y = -2500;
      run.step(NO_INPUT);
      hits += count(run, EventKind.HeroHit);
    }
    expect(hits).toBe(0);
  });

  it("takes 20 % of max hp from an enemy and 2 % from a boss in the circle", () => {
    const run = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    const boss = run.data.enemies.findIndex((e) => e.boss);
    const common = spawnAt(run, 0, Role.Sieger, -1500, -1500);
    const big = spawnAt(run, boss, Role.Sieger, 1500, -1500);
    run.enemies.stunTicks[common] = 1000;
    run.enemies.stunTicks[big] = 1000;
    debugHazard(run);
    for (let i = 0; i < HAZARD_CAPACITY; i++) {
      if (run.hazard.ticks[i] === 0) continue;
      const slot = i % 2 === 0 ? common : big;
      run.hazard.x[i] = run.enemies.x[slot]!;
      run.hazard.y[i] = run.enemies.y[slot]!;
    }
    const hp = [run.enemies.hp[common]!, run.enemies.hp[big]!];
    const strikes = [0, 0];
    for (let i = 0; i < HAZARD_CAPACITY; i++) if (run.hazard.ticks[i]! > 0) strikes[i % 2]!++;
    for (let s = 0; s < 36; s++) run.step(NO_INPUT);
    expect(hp[0]! - run.enemies.hp[common]!).toBeCloseTo(strikes[0]! * 0.2 * run.enemies.maxHp[common]!, 6);
    expect(hp[1]! - run.enemies.hp[big]!).toBeCloseTo(strikes[1]! * 0.02 * run.enemies.maxHp[big]!, 6);
  });

  it("the spirit shield stops a bolt, and a run that ended strikes no more", () => {
    const shielded = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    debugHazard(shielded);
    shielded.hazard.x.fill(shielded.hero.x);
    shielded.hazard.y.fill(shielded.hero.y);
    shielded.shieldTicks = 1000;
    let hits = 0;
    for (let s = 0; s < 36; s++) {
      shielded.step(NO_INPUT);
      hits += count(shielded, EventKind.HeroHit);
    }
    expect(hits).toBe(0);

    const ended = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    debugHazard(ended);
    ended.step(NO_INPUT);
    ended.hero.hp = -1;
    ended.step(NO_INPUT);
    expect(ended.state).toBe("lost");
    let strikes = 0;
    for (let s = 0; s < 40; s++) {
      ended.step(NO_INPUT);
      strikes += count(ended, EventKind.Hazard, 1);
    }
    expect(strikes).toBe(0);
  });

  it("from startPhase 11 the first wave comes everySeconds after the start", () => {
    const run = createRun(quiet(), { seed: 4, durationSeconds: 100000, startPhase: 11 });
    const { min, max } = run.data.worlds[0]!.hazard.everySeconds;
    const start = run.tick;
    const list = waves(run, max + 5);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.tick - start).toBeGreaterThanOrEqual(min * 30);
    expect(list[0]!.tick - start).toBeLessThanOrEqual(max * 30);
  });

  it("draws nothing from run.rng: the first pack is the same with a storm that never comes", () => {
    const first = (data: GameData) => {
      const run = createRun(data, { seed: 1 });
      for (let s = 0; s < 250 * 30 && run.stats.spawned === 0; s++) run.step(NO_INPUT);
      return Array.from({ length: 6 }, (_, i) => [run.enemies.type[i], run.enemies.x[i], run.enemies.y[i]]);
    };
    const late = gameData();
    for (const w of late.worlds) w.hazard.fromPhase = 99;
    const data = gameData();
    data.rules.run.firstPackSeconds = 200;
    late.rules.run.firstPackSeconds = 200;
    expect(first(data)).toEqual(first(late));
  });

  it("debugHazard starts a wave in the same step and announces it", () => {
    const run = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    debugHazard(run);
    expect(run.hazard.waves).toBe(1);
    expect(hazardPending(run)).toBeGreaterThan(0);
    expect(count(run, EventKind.HazardWave)).toBe(1);
  });
});
