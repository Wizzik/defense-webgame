import { describe, expect, it } from "vitest";
import type { GameData } from "../../data/schema";
import { Action, Role } from "../enemies";
import { NO_INPUT } from "../input";
import { createRun } from "../run";
import { Rng } from "../rng";
import { spawnAt } from "../spawner";
import { gameData } from "../testing/game-data";
import { silenceSpawns } from "../testing/silence";
import { isFree } from "./geometry";
import { blockedReachable, cellOf } from "./grid";
import { buildWorldMap } from "./map";

const data: GameData = gameData();
const BRIDGES: [number, number][] = [[-900, 1205], [1150, 1100]];
const PASSAGES: [number, number][] = [[919, 919], [-919, 919], [-919, -919], [919, -919]];

describe("worlds 2 and 3", () => {
  it("world 2 and 3 keep every free cell reachable from the castle on 200 seeds", () => {
    for (const world of [2, 3]) {
      const { count } = data.worlds[world - 1]!.map.islands;
      for (let seed = 1; seed <= 200; seed++) {
        const map = buildWorldMap(data, world, new Rng(seed));
        const { free, reached } = blockedReachable(map);
        expect(reached, `world ${world} seed ${seed}`).toBe(free);
        expect(map.islandCount, `world ${world} seed ${seed}`).toBeGreaterThanOrEqual(count.min);
        expect(map.islandCount, `world ${world} seed ${seed}`).toBeLessThanOrEqual(count.max);
      }
    }
  });

  it("the river blocks its cells and leaves both bridges open", () => {
    const map = buildWorldMap(data, 2, new Rng(1));
    expect(map.blocked[cellOf(-2200, 1324)]).toBe(1);
    expect(map.blocked[cellOf(2300, 1038)]).toBe(1);
    for (const [x, y] of BRIDGES) expect(map.blocked[cellOf(x, y)], `${x},${y}`).toBe(0);
  });

  it("the tree ring blocks the ring and leaves the four diagonal passages open", () => {
    const map = buildWorldMap(data, 3, new Rng(1));
    expect(map.blocked[cellOf(0, 1300)]).toBe(1);
    expect(map.blocked[cellOf(-1300, 0)]).toBe(1);
    for (const [x, y] of PASSAGES) expect(map.blocked[cellOf(x, y)], `${x},${y}`).toBe(0);
  });

  it("no island lands on a bridge, a passage or a path", () => {
    const bad: string[] = [];
    for (const [world, points] of [[2, BRIDGES], [3, PASSAGES]] as const) {
      const gap = data.worlds[world - 1]!.map.islands.gap;
      for (let seed = 1; seed <= 200; seed++) {
        const map = buildWorldMap(data, world, new Rng(seed));
        for (let i = 0; i < map.islandCount; i++) {
          for (const [x, y] of points) {
            const dx = map.islandX[i]! - x;
            const dy = map.islandY[i]! - y;
            const need = map.islandR[i]! + gap;
            if (dx * dx + dy * dy < need * need) bad.push(`world ${world} seed ${seed} island ${i} at ${x},${y}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it("an enemy north of the river reaches the castle through a bridge", () => {
    const d = gameData();
    silenceSpawns(d);
    const run = createRun(d, { seed: 1, world: 2, durationSeconds: 100000 });
    run.hero.x = -2500;
    run.hero.y = -2500;
    const s = spawnAt(run, 0, Role.Sieger, 0, 2400);
    expect(s).toBeGreaterThanOrEqual(0);
    const r = d.enemies[0]!.collision;
    let attacked = -1;
    for (let t = 0; t < 2700 && attacked < 0; t++) {
      run.step(NO_INPUT);
      expect(run.enemies.alive[s]).toBe(1);
      expect(isFree(run.map, run.enemies.x[s]!, run.enemies.y[s]!, r - 1), `tick ${t}`).toBe(true);
      if (run.enemies.action[s] === Action.Attack) attacked = t;
    }
    expect(attacked).toBeGreaterThan(0);
  });
});

const PASS: [number, number][] = [[1061, 1061]];
const BREACHES: [number, number][] = [[679, 1319], [-1412, 452], [-679, -1319], [1412, -452]];

describe("worlds 4 and 5", () => {
  it("world 4 and 5 keep every free cell reachable from the castle on 200 seeds", () => {
    for (const world of [4, 5]) {
      const { count } = data.worlds[world - 1]!.map.islands;
      for (let seed = 1; seed <= 200; seed++) {
        const map = buildWorldMap(data, world, new Rng(seed));
        const { free, reached } = blockedReachable(map);
        expect(reached, `world ${world} seed ${seed}`).toBe(free);
        expect(map.islandCount, `world ${world} seed ${seed}`).toBeGreaterThanOrEqual(count.min);
        expect(map.islandCount, `world ${world} seed ${seed}`).toBeLessThanOrEqual(count.max);
      }
    }
  });

  it("the ice ridge blocks its arc and leaves the pass open", () => {
    const map = buildWorldMap(data, 4, new Rng(1));
    for (const [x, y] of [[0, 1500], [1500, 0], [-1149, 964]]) expect(map.blocked[cellOf(x!, y!)], `${x},${y}`).toBe(1);
    for (const [x, y] of [...PASS, [-1600, 300], [700, -1600]]) expect(map.blocked[cellOf(x!, y!)], `${x},${y}`).toBe(0);
  });

  it("the broken wall blocks its sides and leaves the four breaches open", () => {
    const map = buildWorldMap(data, 5, new Rng(1));
    for (const [x, y] of [[0, 1600], [-1600, 0], [1131, -1131]]) expect(map.blocked[cellOf(x!, y!)], `${x},${y}`).toBe(1);
    for (const [x, y] of BREACHES) expect(map.blocked[cellOf(x, y)], `${x},${y}`).toBe(0);
  });

  it("no island lands in the pass or a breach", () => {
    const bad: string[] = [];
    for (const [world, points] of [[4, PASS], [5, BREACHES]] as const) {
      const gap = data.worlds[world - 1]!.map.islands.gap;
      for (let seed = 1; seed <= 200; seed++) {
        const map = buildWorldMap(data, world, new Rng(seed));
        for (let i = 0; i < map.islandCount; i++) {
          for (const [x, y] of points) {
            const dx = map.islandX[i]! - x;
            const dy = map.islandY[i]! - y;
            const need = map.islandR[i]! + gap;
            if (dx * dx + dy * dy < need * need) bad.push(`world ${world} seed ${seed} island ${i} at ${x},${y}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  for (const [world, x, y] of [[4, 0, 2400], [4, -2400, 600], [5, 0, 2400], [5, 2400, 0]] as const) {
    it(`an enemy from (${x}, ${y}) reaches the castle of world ${world}`, () => {
      const d = gameData();
      silenceSpawns(d);
      const run = createRun(d, { seed: 1, world, durationSeconds: 100000 });
      run.hero.x = -2500;
      run.hero.y = -2500;
      const s = spawnAt(run, 0, Role.Sieger, x, y);
      expect(s).toBeGreaterThanOrEqual(0);
      const r = d.enemies[0]!.collision;
      let attacked = -1;
      for (let t = 0; t < 2700 && attacked < 0; t++) {
        run.step(NO_INPUT);
        expect(run.enemies.alive[s]).toBe(1);
        expect(isFree(run.map, run.enemies.x[s]!, run.enemies.y[s]!, r - 1), `tick ${t}`).toBe(true);
        if (run.enemies.action[s] === Action.Attack) attacked = t;
      }
      expect(attacked).toBeGreaterThan(0);
    });
  }
});
