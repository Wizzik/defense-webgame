import { describe, expect, it } from "vitest";
import { debugSpawnEach } from "./debug-spawn";
import { Role } from "./enemies";
import { createRun } from "./run";
import { gameData } from "./testing/game-data";
import { silenceSpawns } from "./testing/silence";

function newRun(maxAlive?: number) {
  const data = gameData();
  silenceSpawns(data);
  if (maxAlive !== undefined) data.rules.enemies.maxAlive = maxAlive;
  return createRun(data, { seed: 1 });
}

describe("debugSpawnEach", () => {
  it("spawns one hunter of every common type north of the hero, and no boss", () => {
    const run = newRun();
    debugSpawnEach(run);
    const e = run.enemies;
    const types = run.data.enemies.filter((d) => !d.boss).length;
    expect(types).toBe(6);
    expect(run.bossCount).toBe(0);
    expect(e.aliveCount).toBe(types);
    for (let i = 0; i < types; i++) {
      expect(e.type[i]).toBe(i);
      expect(e.role[i]).toBe(Role.Hunter);
      expect(e.y[i]).toBe(run.hero.y + 600);
      expect(e.hp[i]).toBe(run.data.enemies[i]!.hp);
      if (i > 0) expect(e.x[i]! - e.x[i - 1]!).toBe(300);
    }
    // the row is centred on the hero
    expect((e.x[0]! + e.x[types - 1]!) / 2).toBeCloseTo(run.hero.x, 9);
    expect(run.stats.spawned).toBe(types);
  });

  it("a full store skips the rest", () => {
    const run = newRun(2);
    debugSpawnEach(run);
    expect(run.enemies.aliveCount).toBe(2);
    expect(run.stats.spawned).toBe(2);
  });
});
