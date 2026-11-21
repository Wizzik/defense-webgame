import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { stateHash } from "./hash";
import type { TickInput } from "./input";
import { Rng } from "./rng";
import { NO_INPUT } from "./input";
import { createRun, type Run } from "./run";
import { gameData } from "./testing/game-data";

function play(seed: number, inputSeed: number, steps: number): number {
  const run = createRun(gameData(), { seed });
  const inputs = new Rng(inputSeed);
  const input: TickInput = { moveX: 0, moveY: 0, card: -1, actions: 0 };
  for (let i = 0; i < steps; i++) {
    input.moveX = inputs.int(3) - 1;
    input.moveY = inputs.int(3) - 1;
    run.step(input);
  }
  return stateHash(run);
}

describe("stateHash", () => {
  it("same seed and inputs give the same hash", () => {
    expect(play(5, 99, 600)).toBe(play(5, 99, 600));
  });

  it("different inputs give a different hash", () => {
    expect(play(5, 99, 600)).not.toBe(play(5, 100, 600));
  });

  it("different seed gives a different hash", () => {
    expect(play(5, 99, 900)).not.toBe(play(6, 99, 900));
  });

  it("covers the spawned count", () => {
    const run = createRun(gameData(), { seed: 5 });
    const before = stateHash(run);
    run.stats.spawned++;
    expect(stateHash(run)).not.toBe(before);
  });
  it.each([
    ["gold", (run: Run) => { run.gold++; }],
    ["chest price", (run: Run) => { run.chestPriceRaw += 1; }],
    ["chests opened", (run: Run) => { run.chestsOpened++; }],
    ["bosses killed", (run: Run) => { run.bossesKilled++; }],
    ["chest rng", (run: Run) => { run.chestRng.next(); }],
    ["chest place", (run: Run) => { run.chests.x[0] += 1; }],
    ["crystal", (run: Run) => { run.crystals.drop(0, 0, 10); }],
    ["coin", (run: Run) => { run.coins.drop(0, 0, 5); }],
    ["heart", (run: Run) => { run.hearts.drop(0, 0, 1); }],
    ["heart value", (run: Run) => { const i = run.hearts.drop(0, 0, 1); stateHashBefore = stateHash(run); run.hearts.value[i] = 2; }],
    ["ultimate request", (run: Run) => { run.ultimateRequested = !run.ultimateRequested; }],
  ])("covers %s", (_name, change) => {
    const run = createRun(gameData(), { seed: 5 });
    stateHashBefore = stateHash(run);
    change(run);
    expect(stateHash(run)).not.toBe(stateHashBefore);
  });

  it.each([
    ["max hp", (run: Run, i: number) => { run.enemies.maxHp[i] += 1; }],
    ["damage scale", (run: Run, i: number) => { run.enemies.damageScale[i] *= 2; }],
    ["spawn tick", (run: Run, i: number) => { run.enemies.spawnTick[i] += 1; }],
    ["last hit tick", (run: Run, i: number) => { run.enemies.lastHitTick[i] += 1; }],
    ["last attack tick", (run: Run, i: number) => { run.enemies.lastAttackTick[i] += 1; }],
    ["facing", (run: Run, i: number) => { run.enemies.facingX[i] += 0.5; }],
  ])("covers a living enemy's %s", (_name, change) => {
    const run = createRun(gameData(), { seed: 5 });
    for (let k = 0; k < 600; k++) run.step(NO_INPUT);
    const i = run.enemies.alive.indexOf(1);
    expect(i).toBeGreaterThanOrEqual(0);
    const before = stateHash(run);
    change(run, i);
    expect(stateHash(run)).not.toBe(before);
  });

  function stepUntil(run: Run, found: () => number, max: number): number {
    const input = { moveX: 0, moveY: 0, card: -1, actions: 0 };
    for (let k = 0; k < max; k++) {
      const i = found();
      if (i >= 0) return i;
      run.step(botInput(run, input));
    }
    return found();
  }

  it("covers a living projectile", () => {
    const run = createRun(gameData(), { seed: 5, hero: "gravecaller" });
    const i = stepUntil(run, () => run.projectiles.alive.indexOf(1), 3000);
    expect(i).toBeGreaterThanOrEqual(0);
    const before = stateHash(run);
    run.projectiles.x[i] += 1;
    expect(stateHash(run)).not.toBe(before);
  });

  it("covers a living ally", () => {
    const run = createRun(gameData(), { seed: 5, hero: "serpent-shaman" });
    const i = stepUntil(run, () => run.allies.alive.indexOf(1), 3000);
    expect(i).toBeGreaterThanOrEqual(0);
    const before = stateHash(run);
    run.allies.x[i] += 1;
    expect(stateHash(run)).not.toBe(before);
  });

  it("covers the card offer", () => {
    const run = createRun(gameData(), { seed: 5 });
    for (let k = 0; k < 6000 && run.state !== "levelUp"; k++) run.step(NO_INPUT);
    expect(run.state).toBe("levelUp");
    const cards = run.offer!.cards;
    expect(cards.length).toBeGreaterThan(1);
    const before = stateHash(run);
    const first = cards[0]!;
    cards[0] = cards[1]!;
    cards[1] = first;
    expect(stateHash(run)).not.toBe(before);
  });

  it("ignores a dead projectile slot", () => {
    const run = createRun(gameData(), { seed: 5 });
    const i = run.projectiles.alive.indexOf(0);
    const before = stateHash(run);
    run.projectiles.x[i] += 1;
    run.projectiles.damage[i] += 1;
    expect(stateHash(run)).toBe(before);
  });
});

let stateHashBefore = 0;

