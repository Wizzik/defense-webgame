import { describe, expect, it } from "vitest";
import type { GameData } from "../data/schema";
import { EventKind } from "./events";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import { createRun, type Run } from "./run";
import { gameData } from "./testing/game-data";

function start(startPhase: number, tweak?: (d: GameData) => void, seed = 1): Run {
  const data = gameData();
  data.rules.debug.phaseXp = data.rules.phases.map((_, i) => i * 100);
  tweak?.(data);
  return createRun(data, { seed, startPhase });
}

function bossSpawns(run: Run): number[] {
  const types: number[] = [];
  for (let k = 0; k < run.events.count; k++) if (run.events.kind[k] === EventKind.BossSpawn) types.push(run.events.value[k]!);
  return types;
}

const typeOf = (run: Run, id: string) => run.data.enemies.findIndex((e) => e.id === id);

describe("start phase", () => {
  it("startPhase 6 starts at 250 s and skips the rush of 180 s", () => {
    const run = start(6);
    expect(run.tick).toBe(250 * 30);
    expect(run.phaseIndex).toBe(5);
    expect(run.nextEvent).toBe(1);
    expect(run.nextPackTick).toBe(250 * 30 + run.data.rules.run.firstPackSeconds * 30);
    expect(run.enemies.aliveCount).toBe(0);
    run.step(NO_INPUT);
    expect(bossSpawns(run)).toEqual([typeOf(run, "iron-marshal")]);
  });

  it("startPhase 21 brings the final boss in the first step", () => {
    const run = start(21);
    expect(run.tick).toBe(run.durationTicks);
    expect(run.inFinale).toBe(true);
    expect(run.nextEvent).toBe(run.data.rules.events.length);
    run.step(NO_INPUT);
    expect(bossSpawns(run)).toEqual([typeOf(run, "dread-regent")]);
    expect(run.finalBossSlot).toBeGreaterThanOrEqual(0);
    expect(run.state).toBe("playing");
  });

  it("the hero gets the phase xp and spends every level-up", () => {
    const run = start(3);
    expect(run.stats.xpGained).toBe(200);
    expect(run.hero.level).toBeGreaterThan(5);
    expect(run.hero.pendingLevelUps).toBe(0);
    expect(run.state).toBe("playing");
    expect(run.offer).toBeNull();
    // the autopilot's rule: spells before attributes
    const learned = run.abilities.reduce((sum, slot) => sum + slot.level, 0);
    expect(learned).toBeGreaterThan(start(1).abilities.reduce((sum, slot) => sum + slot.level, 0));
  });

  it("startPhase 1 is a normal start", () => {
    const plain = createRun(gameData(), { seed: 1 });
    const run = createRun(gameData(), { seed: 1, startPhase: 1 });
    expect(stateHash(run)).toBe(stateHash(plain));
  });

  it("startPhase is deterministic", () => {
    const play = (seed: number) => {
      const run = start(6, undefined, seed);
      for (let i = 0; i < 300; i++) run.step(run.state === "levelUp" ? { ...NO_INPUT, card: 0 } : NO_INPUT);
      return stateHash(run);
    };
    expect(play(4)).toBe(play(4));
    expect(play(5)).not.toBe(play(4));
  });

  it("a startPhase outside 1..phases + 1 throws", () => {
    for (const phase of [0, 22, 1.5, Number.NaN]) {
      expect(() => start(phase), String(phase)).toThrow("startPhase");
    }
  });
});
