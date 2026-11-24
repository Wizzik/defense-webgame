import { describe, expect, it } from "vitest";
import type { GameData } from "../data/schema";
import { chillAttackScale } from "./chill";
import { TICKS_PER_SECOND } from "./constants";
import { Role } from "./enemies";
import { EventKind } from "./events";
import { debugHazard } from "./hazard";
import { stateHash as hashRun } from "./hash";
import { NO_INPUT, type TickInput } from "./input";
import { createRun, type Run } from "./run";
import { spawnAt } from "./spawner";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";
import { WeatherPhase } from "./weather";

const EAST: TickInput = { ...NO_INPUT, moveX: 1 };

function quiet(): GameData {
  const data = gameData();
  silenceSpawns(data);
  return data;
}

function run4(players?: { hero: string }[]): Run {
  return createRun(quiet(), { seed: 1, world: 4, durationSeconds: 100000, players });
}

/** Steps with `input`, keeping heroes and castle whole; counts Chill events. */
function stepN(run: Run, n: number, input: TickInput | TickInput[] = NO_INPUT): number {
  let chills = 0;
  for (let s = 0; s < n; s++) {
    for (const p of run.players) if (p.hero.hp > 0) p.hero.hp = p.hero.stats.maxHp;
    run.castle.hp = run.castle.maxHp;
    run.step(input as TickInput);
    for (let i = 0; i < run.events.count; i++) {
      if (run.events.kind[i] === EventKind.HazardWave && run.events.u[i] === WeatherPhase.Chill) chills++;
    }
  }
  return chills;
}

describe("blizzard chill", () => {
  it("a hero standing 3 s in a blizzard is chilled", () => {
    const run = run4();
    debugHazard(run);
    expect(stepN(run, 89)).toBe(0);
    expect(run.players[0]!.chilled).toBe(false);
    expect(stepN(run, 1)).toBe(1);
    expect(run.players[0]!.chilled).toBe(true);
    expect(stepN(run, 30)).toBe(0);
  });

  it("walking ends the chill, even after the blizzard", () => {
    const run = run4();
    debugHazard(run);
    stepN(run, 3 * TICKS_PER_SECOND);
    expect(run.players[0]!.chilled).toBe(true);
    stepN(run, 15 * TICKS_PER_SECOND);
    expect(run.hazard.weatherTicks).toBe(0);
    expect(run.players[0]!.chilled).toBe(true);
    stepN(run, 1, EAST);
    expect(run.players[0]!.chilled).toBe(false);
    expect(run.players[0]!.stillTicks).toBe(0);
  });

  it("no chill outside a blizzard or without chill", () => {
    const run = run4();
    stepN(run, 200);
    expect(run.players[0]!.chilled).toBe(false);
    const sand = createRun(quiet(), { seed: 1, world: 2, durationSeconds: 100000 });
    debugHazard(sand);
    stepN(sand, 200);
    expect(sand.hazard.weatherTicks).toBeGreaterThan(0);
    expect(sand.players[0]!.chilled).toBe(false);
  });

  it("chill slows base attacks by attackSlow", () => {
    const run = run4();
    expect(chillAttackScale(run)).toBe(1);
    run.players[0]!.chilled = true;
    expect(chillAttackScale(run)).toBeCloseTo(1 / 0.8, 12);
    // a hero next to an enemy attacks with the chilled interval
    expect(spawnAt(run, 0, Role.Sieger, run.hero.x + 60, run.hero.y)).toBeGreaterThanOrEqual(0);
    run.hero.attackCooldown = 0;
    run.step(NO_INPUT);
    expect(run.hero.attackCooldown).toBe(Math.round((run.hero.stats.attackIntervalSeconds * TICKS_PER_SECOND) / 0.8));
  });

  it("a fallen or choosing hero does not freeze", () => {
    const run = run4([{ hero: "stonehorn" }, { hero: "sparkshot" }, { hero: "tidecaller" }]);
    // player 1 gets a level-up offer: his 5 s of choice time start at the end of the first step
    run.players[1]!.hero.pendingLevelUps = 1;
    run.step([NO_INPUT, NO_INPUT, NO_INPUT]);
    expect(run.players[1]!.choosingTicks).toBeGreaterThan(120);
    debugHazard(run);
    run.players[0]!.hero.hp = 0;
    for (let s = 0; s < 120; s++) {
      run.players[2]!.hero.hp = run.players[2]!.hero.stats.maxHp;
      run.castle.hp = run.castle.maxHp;
      run.step([NO_INPUT, NO_INPUT, NO_INPUT]);
    }
    expect(run.players[0]!.chilled).toBe(false);
    expect(run.players[1]!.chilled).toBe(false);
    expect(run.players[2]!.chilled).toBe(true);
  });

  it("standing through the choice time does not chill at its end", () => {
    const run = run4([{ hero: "stonehorn" }, { hero: "sparkshot" }]);
    run.players[1]!.hero.pendingLevelUps = 1;
    run.step([NO_INPUT, NO_INPUT]);
    debugHazard(run);
    // the choice time (150 steps) runs out while player 1 stands; then he has 3 s before he freezes
    stepN(run, 150, [NO_INPUT, NO_INPUT]);
    expect(run.players[1]!.choosingTicks).toBe(0);
    stepN(run, 60, [NO_INPUT, NO_INPUT]);
    expect(run.players[1]!.chilled).toBe(false);
  });

  it("a revived hero is not chilled at once", () => {
    const run = run4([{ hero: "stonehorn" }, { hero: "sparkshot" }]);
    debugHazard(run);
    run.players[1]!.hero.hp = 0;
    for (let s = 0; s < 120; s++) {
      run.players[0]!.hero.hp = run.players[0]!.hero.stats.maxHp;
      run.castle.hp = run.castle.maxHp;
      run.step([EAST, NO_INPUT]);
    }
    run.players[1]!.hero.hp = run.players[1]!.hero.stats.maxHp;
    stepN(run, 30, [EAST, NO_INPUT]);
    expect(run.players[1]!.chilled).toBe(false);
  });

  it("roots do not count as standing", () => {
    const run = run4();
    debugHazard(run);
    run.hero.rootTicks = 200;
    stepN(run, 150);
    expect(run.players[0]!.chilled).toBe(false);
  });

  it("each player has his own chill", () => {
    const run = run4([{ hero: "stonehorn" }, { hero: "sparkshot" }]);
    debugHazard(run);
    stepN(run, 120, [NO_INPUT, EAST]);
    expect(run.players[0]!.chilled).toBe(true);
    expect(run.players[1]!.chilled).toBe(false);
  });

  it("pause does not count", () => {
    const run = run4();
    debugHazard(run);
    stepN(run, 10);
    run.state = "levelUp";
    const before = run.players[0]!.stillTicks;
    for (let s = 0; s < 200; s++) run.step({ ...NO_INPUT, card: -1 });
    expect(run.state).toBe("levelUp");
    expect(run.players[0]!.stillTicks).toBe(before);
  });

  it("the hash covers chill only in a chill world", () => {
    const run = run4();
    const a = hashRun(run);
    run.players[0]!.chilled = true;
    expect(hashRun(run)).not.toBe(a);
    const w1 = createRun(quiet(), { seed: 1, durationSeconds: 100000 });
    const b = hashRun(w1);
    w1.players[0]!.stillTicks = 77;
    expect(hashRun(w1)).toBe(b);
  });
});
