import { describe, expect, it } from "vitest";
import type { GameData, Weather } from "../data/schema";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { debugHazard } from "./hazard";
import { stateHash as hashRun } from "./hash";
import { moveHero } from "./hero";
import { NO_INPUT, type TickInput } from "./input";
import { createRun, type Run } from "./run";
import { spawnAt } from "./spawner";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";
import { updateEnemies } from "./enemy-ai";
import { WeatherPhase, weatherSpeedScale } from "./weather";

function quiet(): GameData {
  const data = gameData();
  silenceSpawns(data);
  return data;
}

function sand(run: Run): Weather {
  const h = run.data.worlds[1]!.hazard;
  if (h.kind !== "weather") throw new Error("world 2 has no weather");
  return h;
}

/** Steps a quiet world-2 run with a standing, unkillable hero; the ticks of the weather events in order. */
function phases(run: Run, ticks: number): { tick: number; phase: number; seconds: number }[] {
  const out: { tick: number; phase: number; seconds: number }[] = [];
  const pick = { ...NO_INPUT, card: 0 };
  for (let s = 0; s < ticks; s++) {
    run.hero.hp = run.hero.stats.maxHp;
    run.castle.hp = run.castle.maxHp;
    run.step(pick);
    for (let i = 0; i < run.events.count; i++) {
      if (run.events.kind[i] !== EventKind.HazardWave) continue;
      out.push({ tick: run.tick - 1, phase: run.events.u[i]!, seconds: run.events.value[i]! });
    }
  }
  return out;
}

const T = 30;

describe("sandstorm", () => {
  it("announces the sandstorm warnSeconds ahead, then runs it durationSeconds", () => {
    const run = createRun(quiet(), { seed: 1, world: 2, durationSeconds: 100000 });
    const w = sand(run);
    const phase2 = Math.round((w.fromPhase - 1) * run.data.rules.run.phaseSeconds * T);
    const ev = phases(run, phase2 + (w.everySeconds.max + w.durationSeconds + 2) * T);
    expect(ev.slice(0, 3).map((e) => e.phase)).toEqual([WeatherPhase.Warn, WeatherPhase.Start, WeatherPhase.End]);
    const [warn, start, end] = ev;
    expect(warn!.tick).toBeGreaterThanOrEqual(phase2 + (w.everySeconds.min - w.warnSeconds) * T);
    expect(warn!.tick).toBeLessThanOrEqual(phase2 + (w.everySeconds.max - w.warnSeconds) * T);
    expect(warn!.seconds).toBe(w.warnSeconds);
    expect(start!.tick - warn!.tick).toBe(w.warnSeconds * T);
    expect(start!.seconds).toBe(w.durationSeconds);
    expect(end!.tick - start!.tick).toBe(w.durationSeconds * T);
    expect(end!.seconds).toBe(0);
    expect(run.hazard.waves).toBe(1);
  });

  it("the next storm follows its gap after the end", () => {
    const run = createRun(quiet(), { seed: 1, world: 2, durationSeconds: 100000 });
    const w = sand(run);
    const phase2 = Math.round((w.fromPhase - 1) * run.data.rules.run.phaseSeconds * T);
    const ev = phases(run, phase2 + 2 * (w.everySeconds.max + w.durationSeconds + 2) * T);
    const end1 = ev[2]!;
    const warn2 = ev[3]!;
    expect(warn2.phase).toBe(WeatherPhase.Warn);
    expect(warn2.tick - end1.tick).toBeGreaterThanOrEqual((w.everySeconds.min - w.warnSeconds) * T);
    expect(warn2.tick - end1.tick).toBeLessThanOrEqual((w.everySeconds.max - w.warnSeconds) * T);
  });

  it("slows the walking of the hero and of enemies by moveSlow only while it runs", () => {
    const data = quiet();
    data.worlds[1]!.map.islands.count = { min: 0, max: 0 };
    const calm = createRun(data, { seed: 1, world: 2, durationSeconds: 100000 });
    const storm = createRun(data, { seed: 1, world: 2, durationSeconds: 100000 });
    debugHazard(storm);
    const w = sand(storm);
    expect(weatherSpeedScale(storm)).toBeCloseTo(1 - w.moveSlow, 9);
    expect(weatherSpeedScale(calm)).toBe(1);
    const east: TickInput = { moveX: 1, moveY: 0, card: -1, actions: 0 };
    for (const run of [calm, storm]) {
      run.hero.x = 300;
      run.hero.y = -600;
      moveHero(run, east);
    }
    expect((storm.hero.x - 300) / (calm.hero.x - 300)).toBeCloseTo(1 - w.moveSlow, 9);
    const a = spawnAt(calm, 0, Role.Sieger, 1700, -1700);
    const b = spawnAt(storm, 0, Role.Sieger, 1700, -1700);
    const ax = calm.enemies.x[a]!, ay = calm.enemies.y[a]!;
    updateEnemies(calm);
    updateEnemies(storm);
    const da = Math.sqrt((calm.enemies.x[a]! - ax) * (calm.enemies.x[a]! - ax) + (calm.enemies.y[a]! - ay) * (calm.enemies.y[a]! - ay));
    const db = Math.sqrt((storm.enemies.x[b]! - ax) * (storm.enemies.x[b]! - ax) + (storm.enemies.y[b]! - ay) * (storm.enemies.y[b]! - ay));
    expect(db / da).toBeCloseTo(1 - w.moveSlow, 6);
    for (const run of [calm, storm]) {
      run.hero.x = 300;
      run.hero.y = -600;
      run.hero.dashDirX = 1;
      run.hero.dashDirY = 0;
      run.hero.dashTicks = 3;
      moveHero(run, NO_INPUT);
    }
    expect(storm.hero.x).toBeCloseTo(calm.hero.x, 9);
  });

  it("debug starts the storm at once", () => {
    const run = createRun(quiet(), { seed: 1, world: 2, durationSeconds: 100000 });
    debugHazard(run);
    expect(run.hazard.weatherTicks).toBe(sand(run).durationSeconds * T);
    expect(run.hazard.warnTicks).toBe(0);
    let start = 0;
    for (let i = 0; i < run.events.count; i++) {
      if (run.events.kind[i] === EventKind.HazardWave && run.events.u[i] === WeatherPhase.Start) start++;
    }
    expect(start).toBe(1);
    const wood = createRun(quiet(), { seed: 1, world: 3, durationSeconds: 100000 });
    const before = hashRun(wood);
    debugHazard(wood);
    expect(hashRun(wood)).toBe(before);
    expect(wood.hazard.weatherTicks).toBe(0);
  });

  it("a new run starts without a storm", () => {
    const old = createRun(quiet(), { seed: 1, world: 2, durationSeconds: 100000 });
    debugHazard(old);
    old.step(NO_INPUT);
    expect(old.hazard.weatherTicks).toBeGreaterThan(0);
    const fresh = createRun(quiet(), { seed: 1, world: 2, durationSeconds: 100000 });
    expect(fresh.hazard.weatherTicks).toBe(0);
    expect(fresh.hazard.warnTicks).toBe(0);
  });

  it("the hash covers the storm", () => {
    const run = createRun(quiet(), { seed: 1, world: 2, durationSeconds: 100000 });
    const before = hashRun(run);
    run.hazard.weatherTicks = 7;
    expect(hashRun(run)).not.toBe(before);
    run.hazard.weatherTicks = 0;
    run.hazard.warnTicks = 9;
    expect(hashRun(run)).not.toBe(before);
  });
});
