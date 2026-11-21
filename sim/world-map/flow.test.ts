import { describe, expect, it } from "vitest";
import { Role } from "../enemies";
import { updateEnemies } from "../enemy-ai";
import { createRun } from "../run";
import { Rng } from "../rng";
import { spawnAt } from "../spawner";
import { gameData } from "../testing/game-data";
import { silenceSpawns } from "../testing/silence";
import { computeFlow, crossesFeature, FlowField } from "./flow";
import { cellOf, MAP_SIZE } from "./grid";
import { heroFlow } from "./hero-flow";
import { buildWorldMap } from "./map";

function follows(field: FlowField, start: number, target: number): boolean {
  let cell = start;
  for (let k = 0; k < MAP_SIZE * MAP_SIZE && cell !== target; k++) {
    cell = field.next[cell]!;
    if (cell < 0) return false;
  }
  return cell === target;
}

describe("flow fields", () => {
  it("every free cell leads to the castle's cell and to the hero's cell (world 1, seeds 1-20)", () => {
    const data = gameData();
    for (let seed = 1; seed <= 20; seed++) {
      const map = buildWorldMap(data, 1, new Rng(seed));
      const toHero = new FlowField();
      computeFlow(map, toHero, 0, 500);
      const castleCell = cellOf(0, 0);
      const heroCell = cellOf(0, 500);
      for (let c = 0; c < MAP_SIZE * MAP_SIZE; c++) {
        if (map.blocked[c] === 1) continue;
        expect(follows(map.toCastle, c, castleCell), `seed ${seed} cell ${c} castle`).toBe(true);
        expect(follows(toHero, c, heroCell), `seed ${seed} cell ${c} hero`).toBe(true);
      }
    }
  });

  it("crossesFeature sees the wall and the open gate", () => {
    const map = buildWorldMap(gameData(), 1, new Rng(1));
    expect(crossesFeature(map, 0, 1200, 0, 1800, 31)).toBe(true);
    expect(crossesFeature(map, -625, 1200, -625, 1800, 31)).toBe(false);
  });

  it("a sieger from any of 8 directions reaches the castle within 60 s (seeds 1-5)", () => {
    const data = gameData();
    silenceSpawns(data);
    const D = 0.7071067811865476;
    const dirs = [[0, 1], [D, D], [1, 0], [D, -D], [0, -1], [-D, -D], [-1, 0], [-D, D]] as const;
    for (let seed = 1; seed <= 5; seed++) {
      for (const [ux, uy] of dirs) {
        const run = createRun(data, { seed, durationSeconds: 100000 });
        run.hero.x = 2950;
        run.hero.y = -2950;
        const slot = spawnAt(run, 0, Role.Sieger, ux * 2400, uy * 2400);
        const def = run.data.enemies[run.enemies.type[slot]!]!;
        const reach = run.castle.radius + def.collision + def.attack.range + 1;
        let reached = false;
        for (let s = 0; s < 60 * 30 && !reached; s++) {
          run.tick++;
          updateEnemies(run);
          const x = run.enemies.x[slot]!, y = run.enemies.y[slot]!;
          reached = Math.sqrt(x * x + y * y) <= reach;
        }
        expect(reached, `seed ${seed} dir ${ux},${uy}`).toBe(true);
      }
    }
  });

  it("the hero field is recomputed in place during the step", () => {
    const data = gameData();
    silenceSpawns(data);
    const run = createRun(data, { seed: 1, durationSeconds: 100000 });
    const { dist, next } = run.map.toHero;
    run.hero.x = -2000;
    run.hero.y = 2500;
    for (let s = 0; s < 20; s++) {
      run.step({ moveX: 1, moveY: 0, card: -1, actions: 0 });
      const field = heroFlow(run);
      expect(field.dist).toBe(dist);
      expect(field.next).toBe(next);
      expect(field.targetCell).toBe(cellOf(run.hero.x, run.hero.y));
    }
  });
});
