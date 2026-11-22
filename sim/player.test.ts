import { describe, expect, it } from "vitest";
import { stateHash } from "./hash";
import { PlayerState } from "./player";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";

describe("PlayerState of a run", () => {
  it("holds the one hero of a single-player run", () => {
    const run = createRun(gameData(), { seed: 1, hero: "sparkshot" });
    expect(run.players).toHaveLength(1);
    const p = run.players[0]!;
    expect(run.hero).toBe(p.hero);
    expect(run.abilities).toBe(p.abilities);
    expect(run.gear).toBe(p.gear);
    expect(run.buffs).toBe(p.buffs);
    expect(run.heroIndex).toBe(run.data.heroes.findIndex((h) => h.id === "sparkshot"));
    expect(p.abilities.length).toBeGreaterThan(0);
  });

  it("writes the run's player fields into player 0", () => {
    const run = createRun(gameData(), { seed: 1 });
    const p = run.players[0]!;
    run.gold += 25;
    run.ultimateAuto = false;
    run.ultimateRequested = true;
    run.shieldTicks = 7;
    run.openChest = 2;
    expect([p.gold, p.ultimateAuto, p.ultimateRequested, p.shieldTicks, p.openChest]).toEqual([25, false, true, 7, 2]);
  });

  it("hashes every player", () => {
    const run = createRun(gameData(), { seed: 1 });
    const one = stateHash(run);
    const first = run.players[0]!;
    const second = new PlayerState({ ...first.hero, x: first.hero.x + 100 }, first.heroIndex, 4);
    second.abilities = first.abilities;
    run.players.push(second);
    const two = stateHash(run);
    expect(two).not.toBe(one);
    second.gold = 10;
    expect(stateHash(run)).not.toBe(two);
    run.players.pop();
    expect(stateHash(run)).toBe(one);
  });
});
