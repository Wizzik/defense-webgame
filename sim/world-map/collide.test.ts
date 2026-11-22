import { describe, expect, it } from "vitest";
import type { GameData } from "../../data/schema";
import { botInput } from "../bot";
import { placeChest } from "../chests";
import { Role } from "../enemies";
import { updateEnemies } from "../enemy-ai";
import { moveHero } from "../hero";
import { NO_INPUT, type TickInput } from "../input";
import { placeOrb } from "../orbs";
import { createRun, type Run } from "../run";
import { spawnAt } from "../spawner";
import { gameData } from "../testing/game-data";
import { silenceSpawns } from "../testing/silence";
import { isFree } from "./geometry";
import { IslandKind, placeIsland } from "./map";

/** World 1 with its wall and paths but no islands; no packs. */
function wallData(): GameData {
  const data = gameData();
  data.worlds[0]!.map.islands.count = { min: 0, max: 0 };
  silenceSpawns(data);
  return data;
}

function walk(run: Run, moveX: number, moveY: number, steps: number): void {
  const input: TickInput = { moveX, moveY, card: -1, actions: 0 };
  for (let s = 0; s < steps; s++) moveHero(run, input);
}

function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

describe("hero collisions", () => {
  it("stops the hero under the wall and lets it through a gate", () => {
    const run = createRun(wallData(), { seed: 1 });
    run.hero.x = 0;
    run.hero.y = 1200;
    walk(run, 0, 1, 90);
    expect(run.hero.y).toBeLessThanOrEqual(1500 - 45 - 32 + 1e-6);
    run.hero.x = -625;
    run.hero.y = 1200;
    walk(run, 0, 1, 90);
    expect(run.hero.y).toBeGreaterThan(1600);
  });

  it("a dash stops at the wall instead of passing through it", () => {
    const run = createRun(wallData(), { seed: 1 });
    run.hero.x = 0;
    run.hero.y = 1380;
    run.hero.dashDirX = 0;
    run.hero.dashDirY = 1;
    run.hero.dashTicks = 5;
    walk(run, 0, 0, 5);
    expect(run.hero.y).toBeLessThanOrEqual(1500 - 45 - 32 + 1e-6);
    expect(run.hero.dashTicks).toBe(0);
  });

  it("a dash at the river stops on the bank", () => {
    const data = gameData();
    data.worlds[1]!.map.islands.count = { min: 0, max: 0 };
    silenceSpawns(data);
    const run = createRun(data, { seed: 1, world: 2 });
    run.hero.x = -2200;
    run.hero.y = 1000;
    run.hero.dashDirX = 0;
    run.hero.dashDirY = 1;
    run.hero.dashTicks = 12;
    walk(run, 0, 0, 12);
    // the river's axis at x = -2200 lies at y = 1500 - 350 * 700 / 1500 (segment (-3000,1500)-(-1500,1150))
    const axis = 1500 - (350 * 800) / 1500;
    expect(run.hero.y).toBeLessThan(axis - 75 - 32 + 1);
    expect(isFree(run.map, run.hero.x, run.hero.y, 31)).toBe(true);
  });

  it("walks 1.15 times as far on a path", () => {
    const run = createRun(wallData(), { seed: 1 });
    run.hero.x = 0;
    run.hero.y = -1000;
    walk(run, 0, -1, 30);
    const onPath = -1000 - run.hero.y;
    run.hero.x = 1000;
    run.hero.y = -1000;
    walk(run, 0, -1, 30);
    const off = -1000 - run.hero.y;
    expect(onPath / off).toBeCloseTo(1.15, 6);
  });
});

describe("enemy collisions", () => {
  it("an enemy whose charge ended inside an island is outside it after the next step", () => {
    const run = createRun(wallData(), { seed: 1 });
    placeIsland(run.map, 1500, -500, 150, IslandKind.Rock);
    const slot = spawnAt(run, 0, Role.Sieger, 1510, -500);
    updateEnemies(run);
    const r = run.data.enemies[run.enemies.type[slot]!]!.collision;
    expect(len(run.enemies.x[slot]! - 1500, run.enemies.y[slot]! + 500)).toBeGreaterThanOrEqual(150 + r - 1e-6);
  });

  it("a sieger walks around an island on its line and reaches the castle within 20 s", () => {
    const run = createRun(wallData(), { seed: 1 });
    run.hero.x = 2500;
    run.hero.y = 2500;
    placeIsland(run.map, 0, -1200, 150, IslandKind.Rock);
    const slot = spawnAt(run, 0, Role.Sieger, 0, -2000);
    const def = run.data.enemies[run.enemies.type[slot]!]!;
    let reached = false;
    for (let s = 0; s < 600 && !reached; s++) {
      updateEnemies(run);
      const x = run.enemies.x[slot]!;
      const y = run.enemies.y[slot]!;
      expect(len(x, y + 1200), `step ${s}`).toBeGreaterThanOrEqual(150 + def.collision - 2);
      reached = len(x, y) <= run.castle.radius + def.collision + def.attack.range + 1;
    }
    expect(reached).toBe(true);
  });
});

describe("free places", () => {
  it("no chest or orb lies in an obstacle after the first placement and after 30 moves, on 200 seeds", () => {
    const data = gameData();
    const chestR = data.rules.chests.pickupRadius;
    const orbR = data.rules.sustain.orbs.pickupRadius;
    for (let seed = 1; seed <= 200; seed++) {
      const run = createRun(data, { seed });
      for (let k = 0; k <= 30; k++) {
        if (k > 0) {
          placeChest(run, k % run.chests.x.length, false);
          placeOrb(run, k % run.orbs.alive.length);
        }
        for (let c = 0; c < run.chests.x.length; c++) {
          expect(isFree(run.map, run.chests.x[c]!, run.chests.y[c]!, chestR), `seed ${seed} chest ${c}`).toBe(true);
        }
        for (let o = 0; o < run.orbs.alive.length; o++) {
          if (run.orbs.placed[o] === 0) continue;
          expect(isFree(run.map, run.orbs.x[o]!, run.orbs.y[o]!, orbR), `seed ${seed} orb ${o}`).toBe(true);
        }
      }
    }
  });

  it("after 3000 autopilot steps nobody stands deeper than 2 in an obstacle (seed 1, every hero)", () => {
    const data = gameData();
    for (const hero of data.heroes) {
      const run = createRun(data, { seed: 1, hero: hero.id });
      const input: TickInput = { ...NO_INPUT };
      for (let s = 0; s < 3000 && run.state !== "won" && run.state !== "lost"; s++) {
        run.step(botInput(run, input));
        if (s % 50 !== 49) continue;
        const h = run.hero;
        expect(isFree(run.map, h.x, h.y, h.stats.collision - 2), `${hero.id} hero step ${s}`).toBe(true);
        const e = run.enemies;
        for (let i = 0; i < e.capacity; i++) {
          if (e.alive[i] === 0 || e.chargeState[i] !== 0 || e.slamState[i] !== 0) continue;
          const r = data.enemies[e.type[i]!]!.collision;
          expect(isFree(run.map, e.x[i]!, e.y[i]!, r - 2), `${hero.id} enemy ${i} step ${s}`).toBe(true);
        }
      }
    }
  });
});
