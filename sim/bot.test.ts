import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { stateHash } from "./hash";
import { NO_INPUT } from "./input";
import type { TickInput } from "./input";
import { createRun } from "./run";
import type { Run } from "./run";
import { gameData } from "./testing/game-data";

function play(seed: number, onStep?: (run: Run) => void, record?: TickInput[]): Run {
  const run = createRun(gameData(), { seed });
  const input: TickInput = { moveX: 0, moveY: 0, card: -1 };
  let guard = 0;
  while (run.state !== "won" && run.state !== "lost") {
    botInput(run, input);
    if (record) record.push({ moveX: input.moveX, moveY: input.moveY, card: input.card });
    run.step(input);
    onStep?.(run);
    if (++guard > run.durationTicks * 4) throw new Error("run did not end");
  }
  return run;
}

describe("autopilot", () => {
  it("bot run ends within the duration", () => {
    const run = play(1, (r) => {
      expect(r.enemies.aliveCount).toBeLessThanOrEqual(r.data.rules.enemies.maxAlive);
      expect(r.hero.hp).toBeLessThanOrEqual(r.hero.stats.maxHp);
      expect(Number.isNaN(r.hero.x) || Number.isNaN(r.hero.y)).toBe(false);
      for (let i = 0; i < r.enemies.capacity; i++) {
        if (r.enemies.alive[i] === 0) continue;
        expect(Number.isNaN(r.enemies.x[i]) || Number.isNaN(r.enemies.y[i])).toBe(false);
      }
    });
    expect(["won", "lost"]).toContain(run.state);
    expect(run.tick).toBeLessThanOrEqual(run.durationTicks);
  });

  it("replaying recorded inputs gives the same hash", () => {
    const inputs: TickInput[] = [];
    const first = play(2, undefined, inputs);
    const replay = createRun(gameData(), { seed: 2 });
    for (const input of inputs) replay.step(input);
    expect(stateHash(replay)).toBe(stateHash(first));
    expect(replay.result).toBe(first.result);
    expect(replay.tick).toBe(first.tick);
  });

  it("three seeds give three different hashes", () => {
    const hashes = new Set([1, 2, 3].map((seed) => stateHash(play(seed))));
    expect(hashes.size).toBe(3);
  });

  it("moves toward the castle post when no enemy is alive", () => {
    const run = createRun(gameData(), { seed: 1 });
    run.hero.x = 1000;
    const input = botInput(run, { moveX: 0, moveY: 0, card: -1 });
    expect(input.moveX).toBe(-1);
  });

  it("picks card 0 in the level-up state", () => {
    const run = createRun(gameData(), { seed: 1 });
    run.state = "levelUp";
    expect(botInput(run, { moveX: 1, moveY: 1, card: -1 })).toEqual({ moveX: 0, moveY: 0, card: 0 });
  });
});

describe("balance", () => {
  it("idle run loses before the end", () => {
    const run = createRun(gameData(), { seed: 1 });
    // Idle movement, but the cards are taken so that a level-up does not pause the run forever.
    const idle: TickInput = { ...NO_INPUT, card: 0 };
    while (run.state === "playing" || run.state === "levelUp") run.step(idle);
    expect(run.state).toBe("lost");
    expect(run.tick).toBeLessThan(run.durationTicks);
  });

  it("bot wins at least 3 of 5 seeds", () => {
    let wins = 0;
    for (let seed = 1; seed <= 5; seed++) if (play(seed).result === "won") wins++;
    expect(wins).toBeGreaterThanOrEqual(3);
  });

  it("a run sees between 250 and 400 enemies", () => {
    const spawned = play(1).stats.spawned;
    expect(spawned).toBeGreaterThanOrEqual(250);
    expect(spawned).toBeLessThanOrEqual(400);
  });
});
